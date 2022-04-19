export default function (node) {
  let ot = document.activeElement;
  node.onmouseenter = () => {
    ot = document.activeElement;
    node.focus();
  };
  node.onmouseleave = () => {
    node.blur();
    ot?.focus();
  };
}
