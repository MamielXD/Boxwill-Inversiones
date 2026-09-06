export function installAlertOverride() {
  if (typeof window === 'undefined') return;
  if (window.__bw_alert_installed) return;
  window.__bw_alert_installed = true;
  window.alert = function (msg) {
    try {
      let container = document.getElementById('bw-alert-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'bw-alert-container';
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.top = '20px';
        container.style.zIndex = 99999;
        document.body.appendChild(container);
      }
      const el = document.createElement('div');
      el.style.background = 'linear-gradient(90deg,#7f1d1d,#331111)';
      el.style.color = 'white';
      el.style.padding = '10px 14px';
      el.style.marginTop = '8px';
      el.style.borderRadius = '6px';
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
      el.style.maxWidth = '320px';
      el.style.fontSize = '0.9rem';
      el.textContent = msg;
      const btn = document.createElement('button');
      btn.textContent = 'Cerrar';
      btn.style.marginLeft = '8px';
      btn.style.background = 'transparent';
      btn.style.color = '#ffdede';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.onclick = () => el.remove();
      el.appendChild(btn);
      container.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (e) {} }, 6000);
    } catch (e) {
      // fallback
      console.log('alert:', msg);
    }
  };
}
