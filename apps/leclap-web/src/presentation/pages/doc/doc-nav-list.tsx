import { useId } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { docNavGroups } from './docNav';

// The group label shared by the sidebar, the phone menu and the "On this page" list.
export const NAV_LABEL = 'text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gray-500';

// One rail, two densities: the desktop sidebar is a quiet 30px list, the phone menu gets 44px rows
// for a thumb. The left border marks the current page in both, so it reads as one component.
const linkClass = (isActive: boolean, roomy: boolean): string =>
  cn(
    '-ml-px block border-l-2 pl-4 transition-[color,border-color,transform] duration-300 ease-[var(--ease-out-expo)]',
    roomy ? 'py-2.5 text-[0.95rem]' : 'py-1 text-sm',
    isActive
      ? 'translate-x-0.5 border-brand-400 font-medium text-foreground'
      : 'border-transparent text-gray-400 hover:translate-x-0.5 hover:border-brand-400/60 hover:text-foreground'
  );

interface DocNavListProps {
  roomy?: boolean;
  // Lets the phone menu close itself as a page is picked.
  onNavigate?: () => void;
}

// Plain links on purpose, no view transition: between sibling doc pages the sidebar should hold still
// while only the reading column changes. A whole-page cross-fade made the rail itself jump.
export const DocNavList = ({ roomy = false, onNavigate }: DocNavListProps) => {
  const idPrefix = useId();

  return (
    <div className={roomy ? 'space-y-5' : 'space-y-7'}>
      {docNavGroups.map((group, index) => {
        const labelId = `${idPrefix}-group-${index}`;

        return (
          <div key={group.label}>
            <p id={labelId} className={cn(NAV_LABEL, 'mb-2.5')}>
              {group.label}
            </p>
            <ul aria-labelledby={labelId} className="border-l border-divider">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => linkClass(isActive, roomy)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
