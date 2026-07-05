import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

export default function Modal({ title, onClose, children, footer }: Props) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="form-card modal-card">
        <h3 id="modal-title">{title}</h3>
        {children}
        <div className="row-actions modal-footer">{footer}</div>
      </div>
    </div>
  );
}
