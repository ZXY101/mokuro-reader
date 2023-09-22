import { showSnackbar } from "$lib/util"

export async function ankiConnect(action: string, params: Record<string, any>) {


  try {
    const res = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({ action, params, version: 6 })
    })
    const json = await res.json()

    if (json.error) {
      throw new Error(json.error)
    }

    return json.result;
  } catch (e: any) {
    showSnackbar(`Error: ${e?.message ?? e}`)
  }
}

export async function getCardInfo(id: string) {
  const [noteInfo] = await ankiConnect('notesInfo', { notes: [id] });
  return noteInfo;
}

export async function getLastCardId() {
  const notesToday = await ankiConnect('findNotes', { query: 'added:1' });
  const id = notesToday.sort().at(-1);
  return id
}

export async function getLastCardInfo() {
  const id = await getLastCardId()
  return await getCardInfo(id);
}

export function getCardAgeInMin(id: number) {
  return Math.floor((Date.now() - id) / 60000);
}

export async function updateLastCard() {
  const id = await getLastCardId()

  return Math.floor((Date.now() - id) / 60000);
}