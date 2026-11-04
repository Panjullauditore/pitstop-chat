export const DEFAULT_MEMORY_CHARACTERS=18000;
export const MIN_MEMORY_CHARACTERS=1000;
export const MAX_MEMORY_CHARACTERS=100000;
export const MEMORY_CONTEXT_WARNING_CHARACTERS=50000;
export function validMemoryLimit(value){return Number.isInteger(value)&&value>=MIN_MEMORY_CHARACTERS&&value<=MAX_MEMORY_CHARACTERS;}
export function memoryCharacterLimit(settings){return validMemoryLimit(settings?.maxCharacters)?settings.maxCharacters:DEFAULT_MEMORY_CHARACTERS;}
