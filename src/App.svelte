<script>
  import CodeEditor from "./components/CodeEditor.svelte";
  import autosize from "./helpers/autosize";
  let blocks = [];
  let code = "";
  import babel from "prettier/parser-babel";
  import prettier from "prettier";

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
    }, 10);
  });
  const BLOCKLIST = [
    {
      type: "code",
      inputs: {
        code: {
          label: "JavaScript code",
          type: "code",
          is: "string",
          default:
            "//Use the 'CONTEXT' variable to get the output of various steps. Write to it to save something\n//Also, it's optionally async, if you put \"await anywhere in your code\"",
        },
      },
      code: ({ code }) => code,
    },
    {
      type: "translate",
      inputs: {
        text: {
          label: "Translate this text: ",
          type: "textarea",
          default: "Bonjour",
          type: "input",
          is: "string",
        },
        to: {
          label: "Translate to",
          type: "select",
          options: ["en", "es"],
          default: "en",
          is: "string",
          type: "select",
        },
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
        log: { label: "Log this text:", type: "textarea", is: "string" },
      },
      code: ({ log }) => {
        return `console.log(${safe(log)})`;
      },
    },
    {
      type: "print context",
      code: () => `console.log("Context is: ", CONTEXT);`,
    },
  ];
  function safe(interpolatedString) {
    return (
      "`" +
      interpolatedString
        .replaceAll("\n", "\\n")
        .replaceAll("`", "\\`")
        .replaceAll("$", "\\$")
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
    let output = `// This variable stores the context of the code as it runs, the setContext function changes it after every step.\nlet CONTEXT = {}\n`;
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
      let code = await block.code(block.inputValues || {});
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
    blocks = [...blocks, _block(BLOCKLIST[0])];
  }
  function _block(block) {
    let inputValues = {};
    if (block.inputs && Object.values(block.inputs).length) {
      inputValues = Object.fromEntries(
        Object.entries(block.inputs).map(([k, v]) => {
          return [k, v.default || getDefault(v.is)];
        })
      );
    }
    function getDefault(type) {
      if (type) {
        switch (type) {
          case "string":
            return "";
          case "object":
            return {};
          case "number":
            return 0;
          default:
            return null;
        }
      } else {
        return null;
      }
    }
    let out = {
      id: Math.random().toString(36).slice(2),
      ...block,
      select: block.type,
      inputValues,
    };
    return out;
  }
  function switchType(id, type) {
    let idx = blocks.findIndex((i) => i.id === id);
    if (idx < 0) {
      return;
    }
    blocks[idx] = _block({ id, ...BLOCKLIST.find((i) => i.type === type) });
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
      bind:value={block.select}
      on:change={() => switchType(block.id, block.select)}
    >
      {#each BLOCKLIST.map((i) => i.type) as type}
        <option value={type}>
          {type[0].toUpperCase()}{type.slice(1)}
        </option>
      {/each}
    </select>
    {#each Object.entries(block.inputs || {}) as [id, input]}
      <label for={`${block.id}_input`}>{input.label}</label>
      {#if input.type === "textarea"}
        <textarea
          id={`${block.id}_input`}
          bind:value={block.inputValues[id]}
          use:autosize
        />
      {:else if input.type === "code"}
        <CodeEditor
          id={`${block.id}_input`}
          code={block.inputValues[id]}
          on:codeUpdate={({ detail: code }) => (
            (block.inputValues[id] = code.detail), code.detail
          )}
        />
      {:else if input.type === "select"}
        <select id={`${block.id}_input`} bind:value={block.inputValues[id]}>
          {#each input.choices || input.options as opt}
            <option value={opt.value || opt}>{opt.label || opt}</option>
          {/each}
        </select>
      {:else}
        <input
          type="text"
          id={`${block.id}_input`}
          bind:value={block.inputValues[id]}
        />
      {/if}
    {/each}
  {/each}
  <button id="addBlock" on:click={addBlock}>Add block</button>
  <CodeEditor readonly {code} />
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
