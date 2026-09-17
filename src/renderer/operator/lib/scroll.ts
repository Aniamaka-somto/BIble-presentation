export function scrollCardIntoView(num: number) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`.vcard[data-vnum="${num}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  })
}