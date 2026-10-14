/* Shared event bus between the page shell (boot / audio / invert) and the
   machine scene. Tiny, dependency-free, module singleton. */

type Fn = () => void;

export const SK = {
  ready: false,
  _cbs: [] as Fn[],
  onReady(fn: Fn) {
    if (this.ready) fn();
    else this._cbs.push(fn);
  },
  fireReady() {
    if (this.ready) return;
    this.ready = true;
    this._cbs.splice(0).forEach((f) => f());
  },
  /* the machine registers this so the shell can flip its casing polarity */
  setShellInvert: null as null | ((on: boolean) => void),
  /* the shell registers this so the machine's SELECT pill can flip the page */
  toggleInvert: null as null | (() => void),
};
