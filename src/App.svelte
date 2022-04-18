<script>
  let blocks = [];
  let code = "";
  import babel from "prettier/parser-babel";
  import prettier from "prettier";
  let SELECTS = {};
  let INPUTS = {};

  function format(code) {
    return prettier.format(code, {
      parser: "babel",
      plugins: [babel],
    });
  }

  import { onMount } from "svelte";
  onMount(async () => {
    setInterval(async () => {
      code = await getCode();
    }, 1000);
  });
  const BLOCKLIST = [
    {
      type: "translate",
      inputs: {
        text: { label: "Translate this text: ", type: "textarea" },
        to: { label: "Translate to", type: "select", options: ["en", "es"] },
      },
      code: ({ text, to }) => {
        return `const translate = require("google-translate-api"); let translated = await translate(${safe(
          text
        )}, {to: ${safe(to)}});\nreturn {translated: translated}`;
      },
      requires: ["google-translate-api"],
    },
    {
      type: "log",
      inputs: {
        log: { label: "Log this text:", type: "textarea" },
      },
      code: ({ log }) => {
        return `console.log(${safe(log)})`;
      },
    },
    { type: "print context", code: `console.log("Context is: ", CONTEXT);` },
  ];
  function safe(interpolatedString) {
    return (
      "`" +
      interpolatedString
        .replaceAll("\n", "\\n")
        .replaceAll("`", "\\`")
        .replace(
          /{{(.*?)}}/g,
          (_, one) => `\$\{CONTEXT[${JSON.stringify(one)}]\}`
        ) +
      "`"
    );
  }
  async function getCode() {
    if (!blocks.length) {
      return `//No blocks added`;
    }
    let output = ``;
    if (blocks.find((i) => i.requires?.length)) {
      output += `
		// To install the needed npm modules for this project run:
		// npm install ${blocks
      .map((i) => i.requires)
      .flat()
      .join(" ")}
		`;
    }
    for (let i in blocks) {
      let block = blocks[i];
      let fn = ``;
      let code = "return 'cool'"; /* await block.code(INPUTS[block.id] || {}) */
      if (code.includes("await")) {
        fn = `await (async () => {
				 ${code}
			 })().then(setContext)`;
      } else if (!code.includes("return")) {
        fn = code;
      } else {
        fn = `setContext((() => {\n${code}\n})())`;
      }
      output += `
			// Step ${parseInt(i) + 1} of ${blocks.length}: ${block.type}
		 	${fn}\n\n
		  `;
    }
    output += `function setContext(newContext){
		CONTEXT = {...CONTEXT, ...newContext};
		return CONTEXT;
	}`;
    return format(output);
  }
  function addBlock() {
    blocks = [
      ...blocks,
      { id: Math.random().toString(36).slice(2), ...BLOCKLIST[0] },
    ];
  }
  function switchType(id, type) {
    let idx = blocks.findIndex((i) => i.id === id);
    if (idx < 0) {
      return;
    }
    blocks[idx] = { id, ...BLOCKLIST.find((i) => i.type === type) };
  }
</script>

<main>
  {#if !blocks.length}
    <div id="noBlocks">No blocks yet, click the "+" button to add one!</div>
  {/if}
  {#each blocks as block}
    <div id="blockLabel">
      Step {blocks.findIndex((i) => i.id === block.id) + 1} of {blocks.length}:
      {block.type}
    </div>
    <select
      bind:value={SELECTS[block.id]}
      on:change={() => switchType(block.id, SELECTS[block.id])}
    >
      {#each BLOCKLIST.map((i) => i.type) as type}
        <option value={type}>
          {type[0].toUpperCase()}{type.slice(1)}
        </option>
      {/each}
    </select>
    {#each Object.entries(block.inputs || {}) as [id, input]}
      {input.label}
      <input type="text" bind:value={INPUTS[block.id + "|" + id]} />
    {/each}
  {/each}
  <button id="addBlock" on:click={addBlock}>Add block</button>
  <textarea readonly>{code}</textarea>
</main>

<style lang="less">
  @color: #315c7b;
  @secondary: #49979a;
  @secondary_bright: #84b7b4;
  @background: #fefefe;
  @tertiary: #c15154;
  @radius_md: 5px;
  @thin_border: 0.1rem;
  @color_bright: lighten(@color, 30%);
  @text: #333;

  @import "utilities.less";
  :global(html) {
    font-size: 0.8rem;
  }
  .flex() {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  textarea {
    min-height: 400px;
    font-family: "Courier New", Courier, monospace;
  }
  main {
    .flex();
    align-items: stretch;
    min-height: 100vh;
    width: clamp(500px, 80vw, 700px);
    margin: 0 auto;
  }
  #noBlocks {
    font-size: 2rem;
    font-weight: 100;
    text-align: center;
    font-style: italic;
  }
  button {
    margin-top: 1.5rem;
    .button(@secondary);
  }
</style>
