/**
 * Helper to create DOM elements with class, attributes, and children.
 */
export type Child = Node | string | null | undefined | false;

export type Attrs = Record<string, string>;

export function el(
  tag: string,
  className?: string,
  children?: Child[],
  attrs?: Attrs,
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
  }
  return node;
}

export function div(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('div', className, children, attrs);
}

export function span(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('span', className, children, attrs);
}

export function aside(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('aside', className, children, attrs);
}

export function nav(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('nav', className, children, attrs);
}

export function header(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('header', className, children, attrs);
}

export function main(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('main', className, children, attrs);
}

export function footer(className?: string, children?: Child[], attrs?: Record<string, string>) {
  return el('footer', className, children, attrs);
}

export function h1(className?: string, children?: Child[]) { return el('h1', className, children); }
export function h2(className?: string, children?: Child[]) { return el('h2', className, children); }
export function h3(className?: string, children?: Child[]) { return el('h3', className, children); }
export function h4(className?: string, children?: Child[]) { return el('h4', className, children); }
export function p(className?: string, children?: Child[]) { return el('p', className, children); }

export function i(className: string): HTMLElement {
  return el('i', className);
}

export function a(href: string, className: string, children: Child[]): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = className;
  link.href = `#${href}`;
  if (children) for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string') link.appendChild(document.createTextNode(c));
    else link.appendChild(c);
  }
  return link;
}

export function button(
  className: string,
  children: Child[],
  onClick?: (e: MouseEvent) => void,
  attrs?: Record<string, string>,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  if (children) for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string') btn.appendChild(document.createTextNode(c));
    else btn.appendChild(c);
  }
  if (onClick) btn.addEventListener('click', onClick);
  if (attrs) for (const [k, v] of Object.entries(attrs)) btn.setAttribute(k, v);
  return btn;
}

export function icon(name: string): HTMLElement {
  return i(`bi bi-${name}`);
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
