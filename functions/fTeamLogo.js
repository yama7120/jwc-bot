import { AttachmentBuilder } from 'discord.js';
import config from '../config/config.js';

function toLogoBuffer(logoData) {
  if (logoData == null) return null;
  if (Buffer.isBuffer(logoData)) return logoData;
  if (logoData instanceof Uint8Array) return Buffer.from(logoData);
  if (typeof logoData.value === 'function') {
    const value = logoData.value(true);
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
  }
  if (logoData.buffer instanceof Buffer) return logoData.buffer;
  if (logoData.buffer instanceof ArrayBuffer) {
    return Buffer.from(logoData.buffer);
  }
  return null;
}

function sanitizeLogoFileName(team, options = {}) {
  if (options.name) return options.name;
  const abbr = String(team?.clan_abbr ?? 'team')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return `team-logo-${abbr || 'team'}.png`;
}

/**
 * Embed の thumbnail / author icon 用。
 * logo_data があれば attachment://、なければ logo_url / JWC にフォールバック。
 */
function createTeamLogoEmbedAsset(team, options = {}) {
  const name = sanitizeLogoFileName(team, options);
  const preferThumb = options.preferThumb !== false;
  const raw = preferThumb
    ? (team?.logo_data_thumb ?? team?.logo_data)
    : (team?.logo_data ?? team?.logo_data_thumb);
  const buffer = toLogoBuffer(raw);

  if (buffer?.length) {
    return { url: `attachment://${name}`, name, buffer };
  }

  const fallbackUrl =
    typeof team?.logo_url === 'string' && team.logo_url.trim()
      ? team.logo_url.trim()
      : config.urlImage.jwc;

  return { url: fallbackUrl, name, buffer: null };
}

/** followUp / send 用に files へロゴ添付を足す（送信ごとに新しい AttachmentBuilder を作る） */
function withTeamLogo(payload, logoAsset) {
  if (!logoAsset?.buffer) return payload;
  const files = [
    ...(payload.files ?? []),
    new AttachmentBuilder(logoAsset.buffer, { name: logoAsset.name }),
  ];
  return { ...payload, files };
}

export { createTeamLogoEmbedAsset, withTeamLogo, toLogoBuffer };
