export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof elementType)) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

export function setControlGroupHidden(group: HTMLElement, hidden: boolean): void {
  group.hidden = hidden;
  group
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
      'input, select, button'
    )
    .forEach((control) => {
      control.disabled = hidden;
    });
}

export function downloadJsonFile(filename: string, payload: object): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
