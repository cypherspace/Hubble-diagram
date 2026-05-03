// Tiny modal helper used by Cepheid / Spectrum / Light-curve panels.
// Returns the inner content element so the caller can append directly,
// plus a `close` method.

export interface OpenedModal {
  inner: HTMLElement;
  close: () => void;
}

export function openModal(title: string): OpenedModal {
  const backdrop = document.createElement("div");
  backdrop.className = "hb-modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "hb-modal";
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "Close";
  const close = () => backdrop.remove();
  closeBtn.addEventListener("click", close);
  modal.appendChild(closeBtn);
  const h = document.createElement("h3");
  h.textContent = title;
  modal.appendChild(h);
  const inner = document.createElement("div");
  modal.appendChild(inner);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  return { inner, close };
}
