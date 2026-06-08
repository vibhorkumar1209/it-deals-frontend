"use client";

import { Zap } from "lucide-react";
import s from "./signal-intel.module.css";
import { SignalIntelContent } from "./SignalIntelContent";

export default function SignalIntelPage() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.iconBox}>
            <Zap size={16} color="#a78bfa" />
          </div>
          <div>
            <div className={s.headerTitle}>Signal Intelligence</div>
            <div className={s.headerSub}>Real-time buying signals across Executive, Growth, Financial &amp; Tech triggers</div>
          </div>
          <div className={s.headerActions}>
            <a href="/enrich" className={s.navLink}>Deal Finder</a>
            <a href="/tech-stack" className={s.navLink}>Tech Stack</a>
            <a href="/gcc-intel" className={s.navLink}>GCC Intel</a>
          </div>
        </div>
      </header>
      <SignalIntelContent />
    </div>
  );
}
