"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import messages from './messages.en.json';
import {setDateLanguage} from './utils';

export type Language='en'|'id';
type Translator=(text:string,values?:unknown[])=>string;
export const translate=(text:string,language:Language='en',values:unknown[]=[])=>{
  const key=text.trim();
  const translated=language==='en'?(messages as Record<string,string>)[key]||key:key;
  const result=translated.replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]??''));
  return text.slice(0,text.indexOf(key))+result+text.slice(text.indexOf(key)+key.length);
};
const defaultValue={language:'en' as Language,setLanguage:(_language:Language)=>{},t:((text,values)=>translate(text,'en',values)) as Translator};
const LanguageContext=createContext(defaultValue);
export function LanguageProvider({children}:{children:React.ReactNode}){
  const [language,setLanguage]=useState<Language>('en');
  const languageRef=useRef(language);languageRef.current=language;
  const t=useCallback<Translator>((text,values)=>translate(text,languageRef.current,values),[]);
  useEffect(()=>{document.documentElement.lang=language;setDateLanguage(language);},[language]);
  const value=useMemo(()=>({language,setLanguage,t}),[language,t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useI18n=()=>useContext(LanguageContext);
