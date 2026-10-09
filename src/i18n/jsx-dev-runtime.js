import { jsxDEV as reactJsxDEV, Fragment } from 'react/jsx-dev-runtime';
import { localizeProps } from './locale.js';
export { Fragment };
export const jsxDEV = (type, props, key, ...rest) => reactJsxDEV(type, localizeProps(type, props), key, ...rest);
