// <Link> and <NavLink> for the storefront that point straight at a page's canonical address.
//
// Every page is built as <route>/index.html and its canonical URL ends in "/" (scripts/prerender-meta.mjs). GitHub Pages
// and Apache answer "/produktet" with a 301 to "/produktet/", so a link without the slash costs every visitor and
// crawler a redirect hop. These wrappers add the slash to app paths (not to files such as "/og/x.jpg", and not to
// relative or external links), keeping ?query and #hash as they are. React Router matches either form.
import { forwardRef, type MouseEvent } from 'react';
import { Link as RRLink, NavLink as RRNavLink, useNavigate, type LinkProps, type NavLinkProps, type To } from 'react-router';
import { BASE } from './paths';

/** "/produktet?akcija=1" → "/produktet/?akcija=1"; "/", "/og/a.jpg", "/admin/proizvodi", "#x", "https://…" stay as they are. */
export function slashed(to: string): string {
  // the CMS's screens are not for search engines and have no built page each: links into it stay as they are (its
  // entry, /admin, does have one: /admin/)
  if (!to.startsWith('/') || to.startsWith('//') || to.startsWith('/admin/')) return to;
  const cut = to.search(/[?#]/);
  const path = cut < 0 ? to : to.slice(0, cut);
  const rest = cut < 0 ? '' : to.slice(cut);
  if (path.endsWith('/') || /\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf('/') + 1))) return to;
  return `${path}/${rest}`;
}

function fix(to: To): To {
  if (typeof to === 'string') return slashed(to);
  return to.pathname ? { ...to, pathname: slashed(to.pathname) } : to;
}

const isHome = (to: To) => (typeof to === 'string' ? to.split(/[?#]/)[0] : to.pathname) === '/';
const plainClick = (e: MouseEvent<HTMLAnchorElement>) => e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...props }, ref) {
  const navigate = useNavigate();
  // Under a sub-path (/optika/) the router writes the home link as "/optika", which redirects to "/optika/".
  if (BASE !== '/' && isHome(to) && !props.reloadDocument) {
    const { replace, state, preventScrollReset, viewTransition, relative: _r, discover: _d, prefetch: _p, ...a } = props as LinkProps & { prefetch?: unknown };
    const target = typeof to === 'string' ? to : `${to.pathname ?? '/'}${to.search ?? ''}${to.hash ?? ''}`;
    return (
      <a
        ref={ref}
        {...a}
        href={BASE + target.slice(1)}
        onClick={(e) => {
          a.onClick?.(e);
          if (e.defaultPrevented || !plainClick(e) || (a.target && a.target !== '_self')) return;
          e.preventDefault();
          navigate(to, { replace, state, preventScrollReset, viewTransition });
        }}
      />
    );
  }
  return <RRLink ref={ref} to={fix(to)} {...props} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({ to, ...props }, ref) {
  return <RRNavLink ref={ref} to={fix(to)} {...props} />;
});
