import { expect, test } from "bun:test";
import { compileFlavorGenerations } from "./compile-flavors";

const config = `var unrelated = 1;
var viewConfig = { "calc_view": { components: [{
  type: 'CommonRadioGroup', "id": 'calculator_ecs_radio',
  optionKeys: ['arch', 'generation'], sortMethods: {
    0: ['x86'], '1': [ // official selectable generations
      'T6', /* additional regional flavor */ "C7n"
    ]
  }
}]}};`;
test("synchronization compiles official flavor choices independently of property order, quotes, comments and optional tips", () => {
  expect(compileFlavorGenerations(config)).toEqual(["T6", "C7n"]);
});
test("dynamic or missing flavor choices block publication rather than displaying unselectable catalog entries", () => {
  expect(() => compileFlavorGenerations(config.replace("'T6'", "getFlavor()"))).toThrow("unsupported syntax");
  expect(() => compileFlavorGenerations("var viewConfig = {};" )).toThrow("unsupported syntax");
});
