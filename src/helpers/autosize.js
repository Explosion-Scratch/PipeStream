export default function (node, opts) {
  console.log("Running on ", node);
  let old = {
    overflowY: node.style.overflowY,
    height: node.style.height,
  };
  const events = ["input", "keyup", "keydown", "change"];
  const int = setInterval(size, 100);
  events.forEach((i) => node.addEventListener(i, size));
  function size() {
    console.log("Resizing");
    node.style.height = "auto";
    node.style.height = node.scrollHeight + "px";
    node.style.overflowY = "hidden";
  }
  size();
  return {
    destroy: () => {
      Object.assign(node.style, old);
      events.forEach((i) => node.removeEventListener(i, size));
      clearInterval(int);
    },
  };
}
