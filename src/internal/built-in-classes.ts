/**
 * Built-in JavaScript, Web and Node.js classes that `slop/no-instanceof` lets through when they
 * resolve to the global binding. They come from the runtime, not from a package, so a second copy
 * in `node_modules` cannot split them. They are still bound to one realm (a `vm` context, an iframe
 * or jsdom), but most have no better narrowing primitive. `Array`, `Object` and `Function` are left
 * out on purpose: `Array.isArray` and `typeof` handle them in every realm.
 */
export const BUILT_IN_CLASSES: ReadonlySet<string> = new Set([
  // Errors
  'Error',
  'AggregateError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SuppressedError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'DOMException',
  // Values and collections
  'Date',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'FinalizationRegistry',
  'Promise',
  // Binary data
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Buffer',
  // Web platform
  'URL',
  'URLSearchParams',
  'Blob',
  'File',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'ReadableStream',
  'ReadableStreamDefaultReader',
  'WritableStream',
  'TransformStream',
  'AbortController',
  'AbortSignal',
  'TextEncoder',
  'TextDecoder',
  'EventTarget',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  'WebSocket',
  'Worker',
  'CryptoKey',
  'ImageData',
  // DOM
  'Node',
  'Element',
  'CharacterData',
  'Text',
  'Comment',
  'Document',
  'DocumentFragment',
  'ShadowRoot',
  'NodeList',
  'HTMLCollection',
  'Range',
  'Selection',
  'Window',
  // DOM events
  'Event',
  'CustomEvent',
  'UIEvent',
  'FocusEvent',
  'InputEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'WheelEvent',
  'TouchEvent',
  'DragEvent',
  'ClipboardEvent',
  'CompositionEvent',
  'SubmitEvent',
  'FormDataEvent',
  'ToggleEvent',
  'AnimationEvent',
  'TransitionEvent',
  'ErrorEvent',
  'MessageEvent',
  'CloseEvent',
  'ProgressEvent',
  'PopStateEvent',
  'HashChangeEvent',
  'StorageEvent',
  'PageTransitionEvent',
  'BeforeUnloadEvent',
  'PromiseRejectionEvent',
  'SecurityPolicyViolationEvent',
]);

/**
 * DOM element classes (`HTMLInputElement`, `SVGPathElement`, `MathMLElement`, ...), allowed as a
 * family. The pattern is only consulted for global bindings, so an app class with such a name still
 * has to be imported or declared, and is then reported.
 */
export const DOM_ELEMENT_RE = /^(?:HTML|SVG|MathML)\w*Element$/;

/**
 * Global namespace objects whose members are runtime classes, as in `Intl.DateTimeFormat` or
 * `WebAssembly.Module`.
 */
export const BUILT_IN_NAMESPACES: ReadonlySet<string> = new Set([
  'Intl',
  'WebAssembly',
  'Temporal',
]);

/**
 * Global objects through which a built-in may be referenced, as in `globalThis.Date` or
 * `window.HTMLElement`.
 */
export const GLOBAL_OBJECTS: ReadonlySet<string> = new Set([
  'globalThis',
  'window',
  'self',
  'global',
]);
