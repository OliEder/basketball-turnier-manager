// Mechanischer Codemod für die DSS-Migration. Nutzung: node scripts/codemod-dss.mjs button|alert <datei...>
import { readFileSync, writeFileSync } from 'node:fs';

const DSS = '@bbv/dss-design-system/react';

/** Ersetzt den ui-Import durch den DSS-Import und führt mehrere DSS-Importe einer Datei zu einem zusammen. */
function rewriteImports(source, uiModule, names) {
  const uiImport = new RegExp(`import \\{[^}]*\\} from '@/components/ui/${uiModule}'\\n`);
  if (!uiImport.test(source)) return source;
  let out = source.replace(uiImport, `import { ${names.join(', ')} } from '${DSS}'\n`);

  const dssImports = [...out.matchAll(new RegExp(`import \\{([^}]*)\\} from '${DSS}'\\n`, 'g'))];
  if (dssImports.length > 1) {
    const merged = [...new Set(dssImports.flatMap((m) => m[1].split(',').map((n) => n.trim()).filter(Boolean)))];
    let first = true;
    out = out.replace(new RegExp(`import \\{[^}]*\\} from '${DSS}'\\n`, 'g'), () => {
      if (!first) return '';
      first = false;
      return `import { ${merged.join(', ')} } from '${DSS}'\n`;
    });
  }
  return out;
}

const transforms = {
  button(source) {
    return rewriteImports(source, 'button', ['Button'])
      .replaceAll('variant="outline"', 'variant="ghost"')
      .replaceAll('variant="destructive"', 'variant="danger"');
  },
  alert(source) {
    return rewriteImports(source, 'alert', ['Banner'])
      .replaceAll('<Alert>', '<Banner>')
      .replaceAll('</Alert>', '</Banner>')
      .replaceAll(/<Alert(\s)/g, '<Banner$1')
      .replaceAll('<AlertDescription', '<div')
      .replaceAll('</AlertDescription>', '</div>');
  },
};

const [kind, ...files] = process.argv.slice(2);
if (!transforms[kind] || files.length === 0) {
  console.error('Nutzung: node scripts/codemod-dss.mjs button|alert <datei...>');
  process.exit(1);
}
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = transforms[kind](before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`geändert: ${file}`);
  } else {
    console.log(`unverändert: ${file}`);
  }
}
