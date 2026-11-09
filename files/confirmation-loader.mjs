import { registerHooks } from 'node:module';
registerHooks({
  load(url,context,next) {
    const result=next(url,context);
    if(url.endsWith('/tests/e2e/core-runtime.mjs')) {
      let source=String(result.source);
      source="import { createProbe } from '/tmp/confirmation-probe.mjs';\n"+source;
      source=source.replace("const journeyGroup = process.argv[2] ?? 'all';", "const journeyGroup = process.argv[2] ?? 'all';\nconst confirmationProbe=createProbe(state,localAuthSecret,base,journeyGroup);");
      source=source.replace('const page = await context.newPage(),', 'confirmationProbe.attach(context);\n  const page = await context.newPage(),');
      return {...result,source};
    }
    if(url.endsWith('/tests/e2e/operator-request.mjs')) {
      let source=String(result.source);
      source=source.replace('const status = response.status();', "const status = response.status();\n    globalThis.__confirmationProbe?.response(String(url),options.method??'GET',options.data,status);");
      return {...result,source};
    }
    return result;
  }
});
