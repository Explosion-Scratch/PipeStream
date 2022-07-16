<script context="module">
  import SEO from "./components/SEO.svelte";
</script>

<script>
  let page = "generate";

  import CodeEditor from "./components/CodeEditor.svelte";
  import lz from "lz-string";
  import hoverfocus from "./helpers/hoverfocus.js";
  import RK from "./components/RunKit.svelte";
  import autosize from "./helpers/autosize";
  let blocks = [];
  let code = "";
  import babel from "prettier/parser-babel";
  import prettier from "prettier";
  // TODO: Wait until + triggers
  // TODO: Edit code of blocks -> Convert them to code blocks then edit the code
  function format(code) {
    return prettier.format(code, {
      parser: "babel",
      plugins: [babel],
    });
  }
  function getObject(path) {
    if (path.includes(".")) {
      return path.split(".").map(a).join("");
    } else {
      return a(path);
    }
    function a(key) {
      if (/^[a-z_][a-z0-9_]+$/i.test(key)) {
        return `.${key}`;
      } else {
        return `[${JSON.stringify(key)}]`;
      }
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
    if (location.hash) {
      blocks = JSON.parse(
        lz.decompressFromEncodedURIComponent(location.hash.slice(1))
      ).map((b) => {
        return _block(b);
      });
      code = await getCode();
    } else {
      if (localStorage.blocks && validateJSON(localStorage.blocks)) {
        blocks = JSON.parse(localStorage.blocks).map((b) => {
          return _block(b);
        });
        code = await getCode();
      } else {
        localStorage.clear(); // Blocks could be invalid
      }
    }
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
            "//Use the 'CONTEXT' variable to get the output of various steps. Write to it to save something\n//Also, it's optionally async, if you put \"await\" anywhere in your code",
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
      requires: ["isomorphic-fetch"],
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
        return `\nreturn await translate(${safe(text)}, ${safe(
          to
        )});\nasync function translate(text, target, source, proxy = "") {
          if (typeof text == "object") {
            target = text.target;
            source = text.source;
            proxy = text.proxy;
            text = text.text;
          }
          var opts = {
            text: text || "",
            source: source || 'auto',
            target: target || "en",
            proxy: proxy || "",
          }
          var result = await fetch(
            \`https://\${opts.proxy}translate.googleapis.com/translate_a/single?client=gtx&sl=\${opts.source}&tl=\${opts.target}&dt=t&q=\${encodeURI(opts.text)}\`
          ).then(res => res.json());
          return {
            source: opts.source,
            target: opts.target,
            original: text,
            translated: result[0][0][0],
            result,
          };
        }`;
      },
      requires: ["isomorphic-fetch"],
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
    localStorage.setItem("blocks", JSON.stringify(blocks));
    location.hash = lz.compressToEncodedURIComponent(JSON.stringify(blocks));
    if (!blocks.length) {
      return `//No blocks added`;
    }
    let output = `// This variable stores the context of the code as it runs.\nlet CONTEXT = {}\n`;
    if (blocks.find((i) => i?.requires?.length)) {
      output += `
		// To install the needed npm modules for this project run:
		// npm install ${unique(blocks.map((i) => i.requires).flat()).join(" ")}
      ${
        blocks
          .map((i) => i.requires)
          .flat()
          .includes("isomorphic-fetch")
          ? `require("isomorphic-fetch");\n`
          : ""
      }
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
        fn = `CONTEXT${getObject(block.readableId)} = ${fn}`;
      } else if (!code.includes("return")) {
        fn = `CONTEXT${getObject(block.readableId)} = ${code}`;
      } else {
        fn = `(() => {\n${code}\n})()`;
        fn = `CONTEXT${getObject(block.readableId)} = ${fn}`;
      }
      output += `
			// Step ${parseInt(i) + 1} of ${blocks.length}: ${block.type}
		 	${fn}\n\n
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
          return [k, block?.inputValues?.[k] || v.default || getDefault(v.is)];
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
      readableId: `step_${blocks.length + 1}`,
      ...BLOCKLIST.find((i) => i.type === block.type),
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
  function deleteBlock(id) {
    if (!confirm("Are you sure you want to delete this block?")) {
      return;
    }
    let idx = blocks.findIndex((i) => i.id === id);
    if (idx < 0) {
      return console.log("Block not found [delete]");
    }
    blocks.splice(idx, 1);
    blocks = [...blocks];
  }
  function moveBlock(id, amt) {
    if (typeof amt === "string") {
      switch (amt) {
        case "up":
          amt = -1;
          break;
        case "down":
          amt = 1;
          break;
        default:
          throw new Error(`${amt} not valid to move block ${id}`);
      }
    }
    let idx = blocks.findIndex((i) => i.id === id);
    console.log(`Moving block %o (blocks[%o]) %o spots`, id, idx, amt);
    if (idx < 0) {
      throw new Error("Couldn't find block to move (this should never happen)");
    }
    if (idx + amt < 0 || idx + amt >= blocks.length) {
      console.log("Can't move block ", amt);
      return;
    }
    blocks = [...array_move(blocks, idx, idx + amt)];
    function array_move(arr, old_index, new_index) {
      if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
          arr.push(undefined);
        }
      }
      arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
      return arr; // for testing
    }
  }
  function unique(array) {
    return [...new Set(array)];
  }
</script>

<SEO
  title="PipeStream"
  description="Generate readable JavaScript code with a PipeDream like interface"
  color="#00bbbb"
/>
<div id="buttons">
  {#if page === "generate"}
    <button on:click={() => (page = "code")}
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        aria-hidden="true"
        role="img"
        class="iconify iconify--ph"
        width="32"
        height="32"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 256 256"
        ><path
          fill="currentColor"
          d="M67.8 92.6L25.4 128l42.4 35.4a5.9 5.9 0 0 1 .8 8.4A5.8 5.8 0 0 1 64 174a5.9 5.9 0 0 1-3.8-1.4l-48-40a5.9 5.9 0 0 1 0-9.2l48-40a6 6 0 0 1 7.6 9.2Zm176 30.8l-48-40a6 6 0 0 0-7.6 9.2l42.4 35.4l-42.4 35.4a5.9 5.9 0 0 0-.8 8.4a5.8 5.8 0 0 0 4.6 2.2a5.9 5.9 0 0 0 3.8-1.4l48-40a5.9 5.9 0 0 0 0-9.2Zm-81.7-89a5.9 5.9 0 0 0-7.7 3.5l-64 176a5.9 5.9 0 0 0 3.6 7.7a4.5 4.5 0 0 0 2 .4a5.8 5.8 0 0 0 5.6-3.9l64-176a5.9 5.9 0 0 0-3.5-7.7Z"
        /></svg
      ></button
    >
  {:else if page === "code"}
    <button on:click={() => (page = "generate")}
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        aria-hidden="true"
        role="img"
        class="iconify iconify--ph"
        width="32"
        height="32"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 256 256"
        ><path
          fill="currentColor"
          d="M160 214a5.8 5.8 0 0 1-4.2-1.8l-80-80a5.8 5.8 0 0 1 0-8.4l80-80a5.9 5.9 0 0 1 8.4 8.4L88.5 128l75.7 75.8A6 6 0 0 1 160 214Z"
        /></svg
      ></button
    >
  {/if}
</div>
{#if page === "generate"}
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
              use:hoverfocus
              type="text"
              bind:value={block.readableId}
              placeholder="ID"
            /></label
          >
          <div class="right">
            <div class="moveButtons">
              <button id="moveUp" on:click={() => moveBlock(block.id, "up")}
                ><svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  aria-hidden="true"
                  role="img"
                  class="iconify iconify--ph"
                  width="32"
                  height="32"
                  preserveAspectRatio="xMidYMid meet"
                  viewBox="0 0 256 256"
                  ><path
                    fill="currentColor"
                    d="M204.2 116.2a5.8 5.8 0 0 1-8.4 0L134 54.5V216a6 6 0 0 1-12 0V54.5l-61.8 61.7a5.9 5.9 0 0 1-8.4-8.4l72-72a5.8 5.8 0 0 1 8.4 0l72 72a5.8 5.8 0 0 1 0 8.4Z"
                  /></svg
                ></button
              >
              <button
                id="moveDown"
                on:click={() => moveBlock(block.id, "down")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  aria-hidden="true"
                  role="img"
                  class="iconify iconify--ph"
                  width="32"
                  height="32"
                  preserveAspectRatio="xMidYMid meet"
                  viewBox="0 0 256 256"
                  ><path
                    fill="currentColor"
                    d="m204.2 148.2l-72 72a5.8 5.8 0 0 1-8.4 0l-72-72a5.9 5.9 0 0 1 8.4-8.4l61.8 61.7V40a6 6 0 0 1 12 0v161.5l61.8-61.7a5.9 5.9 0 0 1 8.4 8.4Z"
                  /></svg
                >
              </button>
              <button id="delete" on:click={() => deleteBlock(block.id)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  aria-hidden="true"
                  role="img"
                  class="iconify iconify--ph"
                  width="32"
                  height="32"
                  preserveAspectRatio="xMidYMid meet"
                  viewBox="0 0 256 256"
                  ><path
                    fill="currentColor"
                    d="M216 50h-42V40a22.1 22.1 0 0 0-22-22h-48a22.1 22.1 0 0 0-22 22v10H40a6 6 0 0 0 0 12h10v146a14 14 0 0 0 14 14h128a14 14 0 0 0 14-14V62h10a6 6 0 0 0 0-12ZM94 40a10 10 0 0 1 10-10h48a10 10 0 0 1 10 10v10H94Zm100 168a2 2 0 0 1-2 2H64a2 2 0 0 1-2-2V62h132Zm-84-104v64a6 6 0 0 1-12 0v-64a6 6 0 0 1 12 0Zm48 0v64a6 6 0 0 1-12 0v-64a6 6 0 0 1 12 0Z"
                  /></svg
                >
              </button>
            </div>
            <select
              use:hoverfocus
              id="blockTypeSelect"
              bind:value={block.select}
              on:change={() => switchType(block.id, block.select)}
            >
              {#each BLOCKLIST.map((i) => i.type) as type}
                <option value={type} selected={block.select === type}>
                  {type[0].toUpperCase()}{type.slice(1)}
                </option>
              {/each}
            </select>
          </div>
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
                use:hoverfocus
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
              <select
                use:hoverfocus
                id={`${block.id}_input`}
                bind:value={block.inputValues[id]}
              >
                {#each input.choices || input.options as opt}
                  <option
                    value={opt.value || opt}
                    selected={[opt.label, opt, opt.value]
                      .filter(Boolean)
                      .includes(input.default) ||
                      [opt.label, opt, opt.value]
                        .filter(Boolean)
                        .includes(block.inputValues[id])}
                    >{opt.label || opt}</option
                  >
                {/each}
              </select>
            {:else}
              <input
                use:hoverfocus
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
    <button id="viewCode" on:click={() => (page = "code")}>View code</button>
  </main>
{:else if page === "code"}
  <h2 class="codeTitle">Generated code:</h2>
{/if}

<div
  class="wrapper"
  style={page === "code" ? `display: block;` : `display: none;`}
>
  <RK {code} />
</div>

<style lang="less">
  @color: #d04f1c;
  @secondary: #f05d23;
  @secondary_bright: #f27e50;
  @background: #fefefe;
  @tertiary: #c15154;
  @radius_md: 5px;
  @thin_border: 0.1rem;
  @color_bright: lighten(@color, 30%);
  @text: #333;

  @import "utilities.less";
  @import "main.less";
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
  #addBlock {
    margin-top: 1.5rem;
    .button(@secondary);
  }
  #viewCode {
    color: darken(@tertiary, 20);
    .button(@tertiary);
  }
</style>
