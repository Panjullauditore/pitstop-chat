import {cn} from '@/lib/utils';

export function LiveDot({className=''}:{className?:string}){
  return <span aria-hidden="true" className={cn('pitstop-live-dot inline-block h-2 w-2 shrink-0 rounded-full bg-current text-brand-lime',className)}/>;
}
