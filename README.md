# Smallhill Apps

Simple, ad-free, no-tracking apps served at https://apps.smallhill.cz.

## Apps

| App                                                                           | Path                                    | Stack                                              |
| ----------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| [Tuner](apps/tuner)                                                           | `/tuner/`                               | Angular PWA, FE only                               |
| [Scheduler](apps/scheduler)                                                   | `/scheduler/`                           | Angular PWA + Fastify/Postgres                     |
| [CSV Editor](apps/csveditor)                                                  | `/csveditor/`                           | Angular, FE only                                   |
| [Player](apps/player)                                                         | `/player/`                              | Angular PWA + OneDrive, Fastify/Postgres for Sonos |
| [Jachtařská knížka](https://github.com/SmallhillCZ/jachtarskaknizka-1d489984) | https://jachtarskaknizka.eu (own repo)  | React + TanStack Start, FE only                    |
| Zpěvník                                                                       | https://app.dev.zpevniky.com (external) | PWA                                                |

## Development

Each app in `apps/<name>` is an independent project. See its README.
