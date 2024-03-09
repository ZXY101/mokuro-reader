import type { Page } from "$lib/types";

/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

// isNotJapaneseRegex aquired from ttsu reader
// https://github.com/ttu-ttu/ebook-reader/blob/main/apps/web/src/lib/functions/get-character-count.ts

export function countChars(line: string) {
  const isNotJapaneseRegex = /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu
  const cleaned = line.replace(isNotJapaneseRegex, '')

  return Array.from(cleaned).length;
}

export function getCharCount(pages: Page[], currentPage?: number) {
  if (pages && pages.length > 0) {
    const max = currentPage || pages.length
    let charCount = 0;

    for (let i = 0; i < max; i++) {
      const blocks = pages[i].blocks;

      blocks.forEach((block) => {
        block.lines.forEach((line) => {
          charCount += countChars(line);
        });
      });
    }

    return charCount;
  }
}