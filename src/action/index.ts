import { run } from "./main";

// The runner passes the `tests` input, with action.yml's default, as INPUT_TESTS.
process.exitCode = run(process.env.INPUT_TESTS);
