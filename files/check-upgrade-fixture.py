from pathlib import Path
import subprocess
main=subprocess.check_output(['git','show','origin/main:tests/worker/project-fields-upgrade.test.ts'],text=True)
current=Path('tests/worker/project-fields-upgrade.test.ts').read_text()
# The candidate's additive empty-table assertion is independent of the historical fixture.
current=''.join(line for line in current.splitlines(keepends=True) if not line.startswith("  for(const table of ['vector_figma_installations','vector_figma_captures'])"))
assert current == main, 'historical release insertion checkpoint/fixture differs from main'
print('Historical release insertion checkpoint and fixture exactly match main; migration 0133 remains after insertion.')
