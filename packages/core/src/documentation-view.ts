import { type Dataset, type DocumentationSection } from './schema.js'
import { createKnowledgeApi, type KnowledgeOptions } from './knowledge.js'
import { entityServers, type KnowledgeSnapshot } from './knowledge-schema.js'

/**
 * Собирает согласованное представление страниц из предметного снимка и настроек ссылок.
 * Источники передаются в каноническом контракте базы, включая UUID и необязательный summary.
 */
export function toDocumentationDataset(snapshot: KnowledgeSnapshot, options: KnowledgeOptions): Dataset {
  const api = createKnowledgeApi(snapshot, options)
  return {
    schemaVersion: 5,
    dataVersion: snapshot.dataVersion,
    locales: snapshot.locales,
    bases: snapshot.translations.map((translation) => ({
      schemaVersion: 1,
      locale: translation.locale,
      title: translation.title,
      description: translation.summary,
      protocols: api.listProtocols({ locale: translation.locale }).items.flatMap((profile) => {
        const untranslated = translation.locale === 'ru' ? 'Перевод отсутствует' : 'Translation unavailable'
        const profileTitle = profile.title ?? profile.id
        const profileSummary = profile.summary ?? untranslated
        const selected = api.forProtocol({
          id: profile.id,
          locale: translation.locale
        })
        const documents: { file: string; body: string }[] = []
        const overview = selected.getOverview()
        if (overview.description) documents.push({ file: 'overview.md', body: overview.description })
        const sections: DocumentationSection[] = [
          {
            id: 'overview',
            title: translation.locale === 'ru' ? 'Обзор профиля' : 'Profile overview',
            description: profileSummary,
            status: overview.description ? 'partial' : 'missing',
            translationStatus: profile.translationStatus,
            file: overview.description ? 'overview.md' : null,
            children: []
          }
        ]
        const parents = new Map<string, string | null>()
        const entities = [...snapshot.entities].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'en'))
        for (const entity of entities) {
          const view = selected.forServer(entityServers(entity)[0])
          const result =
            entity.kind === 'packet'
              ? view.getPacket(entity.id)
              : entity.kind === 'scenario'
                ? view.getScenario(entity.id)
                : view.getArticle(entity.id)
          if (result.meta.resolution !== 'available') continue
          const id = entity.kind === 'packet' ? `packet.${entity.id}` : entity.id
          const file = result.description ? `${id}.md` : null
          if (file && result.description) documents.push({ file, body: result.description })
          sections.push({
            id,
            title: result.meta.title ?? result.meta.name ?? `${entity.kind}:${entity.id}`,
            description: result.meta.summary ?? untranslated,
            status: result.meta.researchStatus,
            translationStatus: result.meta.translationStatus,
            file,
            children: []
          })
          parents.set(id, entity.parentId)
        }
        for (const section of sections) {
          const parent = sections.find((item) => item.id === parents.get(section.id))
          parent?.children.push(section)
        }
        return [
          {
            schemaVersion: 2 as const,
            id: profile.id,
            number: profile.number,
            title: profileTitle,
            description: profileSummary,
            chronicle: {
              id: profile.chronicle,
              title: profile.chronicleTitle ?? profile.chronicle
            },
            family: profile.family,
            loginRevision: profile.loginRevisions.length === 1 ? profile.loginRevisions[0] : null,
            loginRevisions: profile.loginRevisions,
            region: profile.region,
            clientBuild: null,
            sources: snapshot.sources.filter((source) => profile.sourceIds.includes(source.id)),
            sections: sections.filter((section) => !parents.get(section.id)),
            documents
          }
        ]
      })
    }))
  }
}
