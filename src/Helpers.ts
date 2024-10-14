export function getRandomElements<T>(array: T[], elements = 5): T[] {

    const shuffled = array.slice().sort(() => Math.random() - 0.5)

    return shuffled.slice(0, elements)

}

export function copyToClipboard(event: Event, text: string): Promise<void> {

    const element = event.target as HTMLInputElement

    element.select()
    element.setSelectionRange(0, 99999)

    return navigator.clipboard.writeText(text)

}