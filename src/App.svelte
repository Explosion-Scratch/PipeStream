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
  function getObject(key) {
    if (/^[a-z_][a-z0-9_]+$/i.test(key)) {
      return `.${key}`;
    } else {
      return `[${JSON.stringify(key)}]`;
    }
  }
  function validateJSON(json) {
    try {
      JSON.parse(json);
      return true;
    } catch (_) {
      return false;
    }
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
      type: "fetch",
      code: ({ method, body, url, output }) => {
        let opts = "";
        if (method !== "GET") {
          let realOpts = { method: method.toUpperCase() };
          if (body) {
            if (validateJSON(body)) {
              realOpts.body = JSON.parse(body);
            } else {
              realOpts.body = body;
            }
          }
          opts = `,${JSON.stringify(realOpts)}`;
        }
        return `return await fetch(${safe(
          url
        )}${opts}).then(response => response.${output}())`;
      },
      inputs: {
        url: {
          label: "URL to fetch",
          type: "url",
          is: "string",
          default: "http://md5.jsontest.com/?text=example_text",
        },
        method: {
          type: "select",
          options: ["GET", "POST", "PUT", "PATCH", "DELTE"],
          default: "GET",
        },
        body: {
          type: "code",
          language: "json",
          show: ({ method }) => method !== "GET",
          isValid: (code) => {
            try {
              JSON.parse(code);
              return true;
            } catch (_) {
              return false;
            }
          },
          default: JSON.stringify({}, null, 2),
        },
        output: {
          type: "select",
          default: "json",
          options: ["blob", "json", "text", "arrayBuffer"],
        },
      },
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
        .replace(/{{(.*?)}}/g, (_, one) => `\$\{CONTEXT${getObject(one)}\}`) +
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
			 })()`;
      } else if (!code.includes("return")) {
        fn = code;
      } else {
        fn = `(() => {\n${code}\n})()`;
      }
      output += `
			// Step ${parseInt(i) + 1} of ${blocks.length}: ${block.type}
		 	CONTEXT${getObject(block.readableId)} = ${fn}\n\n
		  `;
    }
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
      readableId: `step_${blocks.length}`,
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
    blocks[idx] = _block({
      id,
      readableId: blocks[idx].readableId,
      ...BLOCKLIST.find((i) => i.type === type),
    });
  }
</script>

<main>
  {#if !blocks.length}
    <div id="noBlocks">No blocks yet, click the "+" button to add one!</div>
  {/if}
  {#each blocks as block}
    <div class="block">
      <div class="group">
        <div id="blockLabel">
          Step {blocks.findIndex((i) => i.id === block.id) + 1} of {blocks.length}:
          {block.type}
        </div>
        <label
          >ID: <input
            type="text"
            bind:value={block.readableId}
            placeholder="ID"
          /></label
        >
        <select
          id="blockTypeSelect"
          bind:value={block.select}
          on:change={() => switchType(block.id, block.select)}
        >
          {#each BLOCKLIST.map((i) => i.type) as type}
            <option value={type}>
              {type[0].toUpperCase()}{type.slice(1)}
            </option>
          {/each}
        </select>
      </div>
      <div class="blockContent">
        {#if !block.inputs || !Object.entries(block.inputs).length}
          <span id="noInputs">This block doesn't have any inputs</span>
        {/if}
        {#each Object.entries(block.inputs || {}) as [id, input]}
          <label for={`${block.id}_input`}
            >{input.label
              ? input.label
              : `${id[0].toUpperCase()}${id.slice(1)}`}</label
          >
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
                <option
                  value={opt.value || opt}
                  selected={[opt.label, opt, opt.value]
                    .filter(Boolean)
                    .includes(input.default)}>{opt.label || opt}</option
                >
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
      </div>
    </div>
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
  // From less style editor I made

  html {
    padding: 50px 0;
    height: fit-content;
    min-height: 100vh;
  }
  .block {
    padding: 20px;
    margin: 10px 0;
    box-shadow: 3px 3px 10px #0001;
    border: 0.15rem dashed #0001;
    border-radius: 10px;
    select {
      background: #0001;
    }
    .group {
      display: flex;
      align-items: center;
      position: relative;
      #blockLabel {
        font-style: italic;
        font-size: 1.1rem;
        opacity: 0.7;
      }
      label {
        display: flex;
        align-items: center;
        margin-left: 1rem;
        opacity: 0.5;
        &:hover,
        &:focus,
        &:focus-within {
          opacity: 1;
        }
        input {
          height: 100%;
          margin: 0;
          margin-left: 0.2rem;
          width: 5rem;
        }
      }
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      border-bottom: 0.15rem dashed #0001;
      #blockTypeSelect {
        width: 15%;
        position: absolute;
        right: 0.2rem;
      }
    }
    #noInputs {
      font-size: 1.2rem;
      font-style: italic;
      opacity: 0.4;
    }
    .blockContent {
      label,
      select,
      input,
      [id*="code_editor"] {
        margin: 0.2rem 0.5rem;
        width: 100%;
        box-sizing: border-box;
      }
      label {
        margin-top: 20px;
        font-size: 1.1rem;
        opacity: 0.6;
      }
    }
  }
</style>
