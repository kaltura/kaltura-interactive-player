export function CreateElement(
  type: string,
  id?: string,
  initialClasses?: string
): HTMLElement {
  const newElement = document.createElement(type);
  if (id) {
    newElement.setAttribute("id", id);
  }
  if (initialClasses) {
    newElement.setAttribute("class", initialClasses);
  }
  return newElement;
}
