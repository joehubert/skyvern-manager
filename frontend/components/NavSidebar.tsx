'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './NavSidebar.module.css';

const navItems = [
  { label: 'Workflow Doc', href: '/workflow-doc' },
  { label: 'Run Analytics', href: '/run-analytics' },
];

export default function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>Skyvern Manager</div>
      <ul className={styles.navList}>
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.active : ''}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
