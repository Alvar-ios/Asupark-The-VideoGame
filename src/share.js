// Compartir por WhatsApp: enlace al juego + mensaje personalizado según el contexto.
export const baseUrl = () => location.origin + location.pathname;
export const inviteUrl = (user) => baseUrl() + (user ? '?add=' + encodeURIComponent(user) : '');
export function waShare(text, url) {
  const msg = url ? text + '\n' + url : text;
  const href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  const w = window.open(href, '_blank', 'noopener'); if (!w) location.href = href;
}
export const WA_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.300 1.200-1.800 1.200-.5.100-1 .2-3.200-.7-2.700-1.100-4.400-3.800-4.500-4-.1-.2-1.100-1.400-1.100-2.700s.7-1.900.9-2.200c.2-.2.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.8 2c.1.200.1.300 0 .500l-.3.400-.4.500c-.1.100-.3.300-.1.600.2.300.8 1.300 1.700 2.100 1.100 1 2 1.300 2.300 1.400.3.200.5.100.6-.1l.9-1.100c.2-.3.400-.2.700-.1l1.900.9c.3.1.5.200.5.300.1.200.1.800-.1 1.400z"/></svg>';
export const waBtn = (label, attrs = '', cls = 'mini wa') => `<button type="button" class="${cls}" ${attrs}>${WA_ICON}${label}</button>`;
