import { AsyncLocalStorage } from 'node:async_hooks';
import { EmbedBuilder } from 'discord.js';
import config from '../config/config.js';

const contextStorage = new AsyncLocalStorage();

const AUTOCOMPLETE_EXPIRED_CODES = new Set([10062, 40060]);

/** @returns {Record<string, unknown>} */
export function getErrorContext() {
  return contextStorage.getStore() ?? {};
}

/**
 * @param {Record<string, unknown>} context
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export function runWithErrorContext(context, fn) {
  return contextStorage.run({ ...getErrorContext(), ...context }, fn);
}

/**
 * @param {import('discord.js').Interaction} interaction
 * @returns {Record<string, string | null>}
 */
export function interactionToContext(interaction) {
  const ctx = {
    type: interaction.isAutocomplete() ? 'autocomplete' : 'command',
    command: interaction.toString(),
    commandName: interaction.commandName ?? null,
    subcommand: null,
    options: '',
    user: `${interaction.user.tag} (${interaction.user.id})`,
    guild: interaction.guild?.name ?? 'DM',
    channel: interaction.channel?.name ?? 'DM',
    channelId: interaction.channel?.id ?? null,
    interactionId: interaction.id,
  };

  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    ctx.subcommand = interaction.options?.getSubcommand(false) ?? null;
    ctx.options = formatInteractionOptions(interaction);
  }

  return ctx;
}

/**
 * @param {import('discord.js').AutocompleteInteraction | import('discord.js').ChatInputCommandInteraction} interaction
 */
function formatInteractionOptions(interaction) {
  const lines = [];
  for (const opt of interaction.options?.data ?? []) {
    if (opt.type === 1) {
      lines.push(`subcommand: ${opt.name}`);
      for (const sub of opt.options ?? []) {
        lines.push(`  ${sub.name} = ${formatOptionValue(sub)}`);
      }
    } else {
      lines.push(`${opt.name} = ${formatOptionValue(opt)}`);
    }
  }
  return lines.join('\n') || '(none)';
}

/** @param {{ value?: unknown; name: string }} opt */
function formatOptionValue(opt) {
  const value = opt.value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * @param {unknown} reason
 * @returns {string}
 */
export function formatErrorReason(reason) {
  if (reason == null) return 'Unknown error (null/undefined)';

  if (reason instanceof Error) {
    let text = reason.stack ?? reason.message ?? String(reason);

    const nested = /** @type {{ errors?: unknown[] }} */ (reason).errors;
    if (Array.isArray(nested) && nested.length > 0) {
      text += '\n\n--- nested errors ---';
      for (const item of nested) {
        if (item instanceof Error) {
          text += `\n${item.stack ?? item.message}`;
        } else {
          text += `\n${String(item)}`;
        }
      }
    }

    return text;
  }

  if (typeof reason === 'object') {
    try {
      return JSON.stringify(reason, null, 2);
    } catch {
      return String(reason);
    }
  }

  return String(reason);
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max = 3900) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 24)}\n...(truncated)`;
}

/**
 * @param {Record<string, unknown>} context
 * @returns {{ name: string; value: string; inline?: boolean }[]}
 */
function contextToFields(context) {
  /** @type {{ name: string; value: string; inline?: boolean }[]} */
  const fields = [];

  const add = (name, value, inline = false) => {
    if (value == null || value === '') return;
    fields.push({
      name,
      value: truncate(String(value), 1020),
      inline,
    });
  };

  add('SOURCE', context.source);
  add('COMMAND', context.command);
  add('SUBCOMMAND', context.subcommand);
  add('OPTIONS', context.options);
  add('USER', context.user);
  add('SERVER', context.guild);
  add('CHANNEL', context.channelId ? `${context.channel} (<#${context.channelId}>)` : context.channel);
  add('INTERACTION ID', context.interactionId);
  add('CRON JOB', context.cronJob);
  add('WAR', context.warInfo);
  add('TAG', context.tag);
  add('NOTE', context.note);

  if (context.extra && typeof context.extra === 'object') {
    try {
      add('EXTRA', JSON.stringify(context.extra, null, 2));
    } catch {
      add('EXTRA', String(context.extra));
    }
  }

  return fields;
}

/**
 * @param {import('discord.js').Client} client
 * @param {unknown} reason
 * @param {{ source?: string; extra?: Record<string, unknown>; context?: Record<string, unknown> }} [options]
 */
export async function reportError(client, reason, options = {}) {
  const { source, extra, context: contextOverride = {} } = options;
  const stored = getErrorContext();
  const ctx = {
    ...stored,
    ...contextOverride,
    source:
      source ??
      contextOverride.source ??
      ctxSourceFromContext({ ...stored, ...contextOverride }),
    extra: extra ?? contextOverride.extra ?? stored.extra,
  };
  const text = formatErrorReason(reason);
  console.error(
    `❌ [${new Date().toISOString()}] [${ctx.source ?? 'error'}]`,
    text,
  );

  const channelId = config.logch?.error;
  if (!client || !channelId) return;

  let channel = client.channels.cache.get(channelId);
  if (!channel) {
    channel = await client.channels.fetch(channelId).catch(() => null);
  }
  if (!channel?.isTextBased?.()) return;

  const embed = new EmbedBuilder()
    .setTitle(`ERROR${ctx.source ? ` - ${ctx.source}` : ''}`)
    .setDescription(`\`\`\`\n${truncate(text)}\n\`\`\``)
    .setColor('#ff0000')
    .setTimestamp();

  const fields = contextToFields(ctx);
  if (fields.length > 0) {
    embed.addFields(fields.slice(0, 25));
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (sendError) {
    console.error('Failed to send error report to Discord:', sendError);
  }
}

/** @param {Record<string, unknown>} ctx */
function ctxSourceFromContext(ctx) {
  if (ctx.cronJob) return `cron:${ctx.cronJob}`;
  if (ctx.type === 'command') return 'command';
  if (ctx.type === 'autocomplete') return 'autocomplete';
  return null;
}

/**
 * Respond to autocomplete; return false when the interaction already expired.
 * @param {import('discord.js').AutocompleteInteraction} interaction
 * @param {import('discord.js').ApplicationCommandOptionChoiceData[]} choices
 */
export async function safeAutocompleteRespond(interaction, choices) {
  try {
    await interaction.respond(choices);
    return true;
  } catch (error) {
    if (AUTOCOMPLETE_EXPIRED_CODES.has(error?.code)) {
      const ctx = interactionToContext(interaction);
      console.warn(
        `[autocomplete] Interaction expired before respond (code ${error.code}): ${interaction.commandName}${ctx.subcommand ? ` / ${ctx.subcommand}` : ''}`,
      );
      return false;
    }
    throw error;
  }
}

/**
 * Log an autocomplete data/flow issue to console and the error channel.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').AutocompleteInteraction} interaction
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 */
export async function reportAutocompleteIssue(
  client,
  interaction,
  message,
  extra = {},
) {
  const ctx = interactionToContext(interaction);
  console.error(`[autocomplete] ${message}`, ctx);
  await reportError(client, new Error(message), {
    source: 'autocomplete',
    extra,
    context: ctx,
  });
}

/**
 * Run an autocomplete handler and detect silent failures (no respond / timeout).
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').AutocompleteInteraction} interaction
 * @param {(interaction: import('discord.js').AutocompleteInteraction, client: import('discord.js').Client) => Promise<void>} handler
 */
export async function runAutocompleteHandler(client, interaction, handler) {
  let responded = false;
  const originalRespond = interaction.respond.bind(interaction);
  interaction.respond = async (choices) => {
    responded = true;
    return originalRespond(choices);
  };

  const ctx = interactionToContext(interaction);

  try {
    await runWithErrorContext(ctx, () => handler(interaction, client));

    if (!responded) {
      const message = `Autocomplete handler returned without respond: ${interaction.commandName}${ctx.subcommand ? ` / ${ctx.subcommand}` : ''}`;
      console.error(message, ctx);
      await reportError(client, new Error(message), {
        source: 'autocomplete',
        context: ctx,
      });
      try {
        await originalRespond([]);
      } catch (fallbackError) {
        if (!AUTOCOMPLETE_EXPIRED_CODES.has(fallbackError?.code)) {
          await reportError(client, fallbackError, {
            source: 'autocomplete',
            extra: { note: 'fallback respond([]) failed' },
            context: ctx,
          });
        } else {
          console.warn(
            `[autocomplete] Timed out before fallback respond (code ${fallbackError.code}): ${interaction.commandName}${ctx.subcommand ? ` / ${ctx.subcommand}` : ''}`,
            ctx,
          );
        }
      }
    }
  } catch (error) {
    if (AUTOCOMPLETE_EXPIRED_CODES.has(error?.code)) {
      console.warn(
        `[autocomplete] Timed out (code ${error.code}): ${interaction.commandName}${ctx.subcommand ? ` / ${ctx.subcommand}` : ''}`,
        ctx,
      );
      return;
    }
    await reportError(client, error, { source: 'autocomplete' });
  }
}
