export function sortDictionaryByValue(obj: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(obj).sort(([, a], [, b]) => a.localeCompare(b)),
  );
}

function getDateTime() {
  return new Date().toLocaleString();
}

export function manageAttendanceSheetContent(content: string[][], names: string[]) {
  if (content === undefined) {
    // eslint-disable-next-line no-param-reassign
    content = [['Name']].concat(Array.from(names, (name) => [name]));
  }
  content[0].push(getDateTime());
  for (let i = 1; i < content.length; i += 1) {
    // if the name is already in the spreadsheet
    if (names.includes(content[i][0])) {
      names.splice(names.indexOf(content[i][0]), 1);
      content[i].push('1');
    } else {
      content[i].push('0');
    }
  }
  // add the new names to the content
  names.forEach((name) => {
    const newRow = Array(content[0].length - 2).fill('0');
    newRow.unshift(name);
    newRow.push('1');
    content.push(newRow);
  });
  return content;
}
