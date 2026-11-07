import type { ReactNode } from 'react';

export function TabletFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="planner-device">
      <div className="planner-bezel">
        <div className="planner-screen">{children}</div>
      </div>
      {footer}
    </div>
  );
}
