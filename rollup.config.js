import minify from "rollup-plugin-babel-minify";
 
export default {
    entry: "./src/index.js",
    moduleName: "Observable",
    dest: "./dist/observable.js",
    format: "umd",
    sourceMap: true,
    plugins: [
        minify({ comments: false })
    ]
};
