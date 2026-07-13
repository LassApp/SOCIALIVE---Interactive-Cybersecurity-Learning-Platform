/**
 * dom.js
 * -----------------------------------------------------------------------
 * Helper minimale per la creazione di nodi DOM nei componenti factory.
 * Senza questo helper, ogni componente ripeterebbe la stessa sequenza
 * createElement + classList.add + setAttribute (violazione DRY, come da
 * regola esplicita di progetto). Ogni componente in js/components/
 * dipende da questo file, non il contrario.
 */

/**
 * @param {string} tag
 * @param {{ classNames?: string|string[], attrs?: Record<string, string|boolean>, dataset?: Record<string,string>, text?: string }} [options]
 * @param {Node[]} [children]
 */
export function createElement(tag, options = {}, children = []) {
  const el = document.createElement(tag);
  const { classNames, attrs, dataset, text } = options;

  if (classNames) {
    (Array.isArray(classNames) ? classNames : [classNames])
      .filter(Boolean)
      .forEach((cls) => el.classList.add(cls));
  }

  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === false || value === null || value === undefined) return;
      el.setAttribute(key, value === true ? "" : value);
    });
  }

  if (dataset) {
    Object.entries(dataset).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
  }

  if (text !== undefined) {
    el.textContent = text;
  }

  children.filter(Boolean).forEach((child) => el.appendChild(child));

  return el;
}

/** Rimuove tutti i figli di un nodo senza passare da innerHTML. */
export function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}
