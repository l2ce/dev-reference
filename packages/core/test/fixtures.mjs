export function dataset(dataVersion = '0.1.0') {
  return {
    schemaVersion: 5,
    dataVersion,
    locales: ['en', 'ru'],
    bases: [
      {
        schemaVersion: 1,
        locale: 'en',
        title: 'English',
        description: 'English base',
        protocols: [
          {
            schemaVersion: 2,
            number: 123,
            title: 'Profile',
            description: 'Research scope',
            chronicle: { id: 'chronicle-a', title: 'Chronicle A' },
            family: 'mainline',
            loginRevision: null,
            region: null,
            clientBuild: null,
            sources: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                title: 'Fixture',
                url: 'https://example.org',
                summary: 'Example section'
              }
            ],
            sections: [
              {
                id: 'overview',
                title: 'Overview',
                description: 'Identification',
                status: 'partial',
                file: 'overview.md'
              },
              {
                id: 'gameplay',
                title: 'Gameplay',
                description: 'World interactions',
                status: 'missing',
                file: null,
                children: [
                  {
                    id: 'movement',
                    title: 'Movement',
                    description: 'Positions',
                    status: 'missing',
                    file: null
                  }
                ]
              }
            ],
            documents: [{ file: 'overview.md', body: `English content ${dataVersion}\n` }]
          }
        ]
      },
      {
        schemaVersion: 1,
        locale: 'ru',
        title: 'Русский',
        description: 'Русская база',
        protocols: []
      }
    ]
  }
}
