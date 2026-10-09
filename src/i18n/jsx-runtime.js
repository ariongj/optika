import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime';
import { localizeProps } from './locale.js';
export { Fragment };
export const jsx = (type, props, key) => reactJsx(type, localizeProps(type, props), key);
export const jsxs = (type, props, key) => reactJsxs(type, localizeProps(type, props), key);
