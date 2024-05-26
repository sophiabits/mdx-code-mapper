# mdx-code-mapper

Run a program against code blocks inside your .md/.mdx files to transform their output.

For instance, to run `prettier` on all of your Markdown code blocks:

```
$ npm install --global mdx-code-mapper
$ mdx-code-mapper --input="*.mdx" -- prettier
```

The contents of each code block will be piped to your specified program via standard input. The content of the code block will be replaced with the output of the program.

If the program returns a non-zero exit code, then `mdx-code-mapper` will forward any stderr output and return a non-zero exit codes itself.

Running `prettier` like this is useful for ensuring a consistent code style in public-facing documentation, and as a CI step to ensure that a docs site contains no syntax errors.
