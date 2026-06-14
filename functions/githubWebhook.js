import crypto from 'node:crypto';
import { EmbedBuilder } from 'discord.js';
import config from '../config/config.js';
import { safeSend } from './functions.js';

const COMMIT_TYPE_COLORS = {
  feat: '#2ecc71',
  fix: '#e74c3c',
  perf: '#3498db',
  refactor: '#9b59b6',
  docs: '#1abc9c',
  chore: '#95a5a6',
  test: '#f39c12',
  ci: '#34495e',
};

/**
 * @param {Buffer|string} rawBody
 * @param {string|undefined} signatureHeader
 * @param {string} secret
 */
function verifyGithubSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** @param {string} message */
function commitTitle(message) {
  return (message ?? '').split('\n')[0].trim() || '(no message)';
}

/** @param {string} title */
function commitColor(title) {
  const match = title.match(/^(\w+)(?:\([^)]*\))?!?:/);
  const type = match?.[1]?.toLowerCase();
  return COMMIT_TYPE_COLORS[type] ?? config.color.main;
}

/** @param {string} id */
function shortHash(id) {
  return (id ?? '').slice(0, 7);
}

/**
 * @param {string[]} files
 * @param {string} label
 * @param {number} [maxFiles]
 */
function formatFiles(files, label, maxFiles = 20) {
  if (!files?.length) return null;
  const lines = files.slice(0, maxFiles).map((f) => `\`${f}\``);
  if (files.length > maxFiles) {
    lines.push(`… 他 ${files.length - maxFiles} 件`);
  }
  return `**${label}** (${files.length})\n${lines.join('\n')}`;
}

/** @param {import('discord.js').Client} client @param {object} commit @param {object} repository */
function buildCommitEmbed(commit, repository) {
  const title = commitTitle(commit.message);
  const hash = shortHash(commit.id);
  const embed = new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setURL(commit.url)
    .setColor(commitColor(title))
    .setAuthor({
      name: repository.full_name,
      iconURL: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
      url: repository.html_url,
    })
    .setTimestamp(new Date(commit.timestamp));

  const fields = [];
  const modified = formatFiles(commit.modified, '変更');
  const added = formatFiles(commit.added, '追加');
  const removed = formatFiles(commit.removed, '削除');

  for (const value of [modified, added, removed]) {
    if (value) fields.push({ name: '\u200b', value: value.slice(0, 1024), inline: false });
  }

  if (fields.length === 0) {
    embed.setDescription('*(ファイル変更なし — merge 等)*');
  } else {
    embed.addFields(fields.slice(0, 25));
  }

  const authorName = commit.author?.name ?? commit.committer?.name ?? 'unknown';
  embed.setFooter({
    text: `${hash} · ${authorName} · ${config.footer}`,
    iconURL: config.urlImage.jwc,
  });

  return embed;
}

/** @param {object} payload */
function isTargetPush(payload) {
  const gh = config.github;
  if (payload.ref !== `refs/heads/${gh.branch}`) return false;
  const repoName = payload.repository?.name ?? '';
  if (repoName !== gh.repo) return false;
  return true;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('discord.js').Client} client
 */
export async function handleGithubWebhook(req, res, client) {
  const secret = (process.env.GITHUB_WEBHOOK_SECRET || config.github?.secret || '').trim();
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ error: 'Expected raw JSON body' });
    return;
  }

  if (!secret) {
    console.error('[githubWebhook] GITHUB_WEBHOOK_SECRET is not set');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  if (!verifyGithubSignature(rawBody, signature, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  if (event === 'ping') {
    console.log('[githubWebhook] ping received:', payload.hook_id ?? 'ok');
    res.json({ ok: true, message: 'pong' });
    return;
  }

  if (event !== 'push') {
    res.status(200).json({ ok: true, ignored: event });
    return;
  }

  if (!isTargetPush(payload)) {
    res.status(200).json({ ok: true, ignored: 'ref or repo filter' });
    return;
  }

  if (!client?.isReady?.()) {
    res.status(503).json({ error: 'Discord client not ready' });
    return;
  }

  const commits = (payload.commits ?? []).filter(
    (c) => !c.message?.startsWith('Merge '),
  );
  const channelId = config.github.channel;

  if (commits.length === 0) {
    res.json({ ok: true, message: 'No commits to notify' });
    return;
  }

  const repository = payload.repository;
  const embeds = commits.map((c) => buildCommitEmbed(c, repository));

  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    const sent = await safeSend(
      client,
      channelId,
      { embeds: chunk },
      'github-push',
    );
    if (!sent) {
      res.status(500).json({ error: 'Failed to send Discord message' });
      return;
    }
  }

  console.log(
    `[githubWebhook] push notified: ${repository.full_name} ${commits.length} commit(s)`,
  );
  res.json({ ok: true, commits: commits.length });
}
