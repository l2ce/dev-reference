import type { ReactNode } from 'react'
import type { DocumentRoute, ProtocolRoute } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Дочернее дерево framework-layout.
 */
export interface LayoutChildren {
  /* Серверное поддерево текущей страницы. */
  readonly children: ReactNode
}

/**
 * Параметры общей HTML-оболочки.
 */
export interface DocumentShellProps extends LayoutChildren {
  /* Язык атрибута html и общего каркаса. */
  readonly locale: Locale
}

/**
 * Асинхронные параметры страницы App Router.
 */
export interface RouteProps<T> {
  /* Параметры, перечисленные generateStaticParams. */
  readonly params: Promise<T>
}

/**
 * Framework-контракт языкового root layout.
 */
export type LocaleLayoutProps = LayoutChildren & RouteProps<{ readonly locale: string }>

/**
 * Framework-контракт страницы каталога.
 */
export type LocalePageProps = RouteProps<{ readonly locale: string }>

/**
 * Framework-контракт страницы протокола.
 */
export type ProtocolPageProps = RouteProps<Omit<ProtocolRoute, 'locale'> & { readonly locale: string }>

/**
 * Framework-контракт страницы документа.
 */
export type DocumentPageProps = RouteProps<DocumentRoute>

/**
 * Параметры протокола в английской ветке без locale-сегмента.
 */
export type EnglishProtocolPageProps = RouteProps<Omit<ProtocolRoute, 'locale'>>

/**
 * Параметры документа в английской ветке без locale-сегмента.
 */
export type EnglishDocumentPageProps = RouteProps<Omit<DocumentRoute, 'locale'>>
