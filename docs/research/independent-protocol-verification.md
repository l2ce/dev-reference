# Независимая проверка повторяющихся номеров протоколов

Исследовательский материал. Принятые решения модели находятся в
[предметной модели](../architecture/domain-model.md).

Дата: **27 октября 2026 года**.

## Результат

**Повтор 152 между Gracia Epilogue и Orfen подтверждается техническими
источниками вне Akumu. Повтор 273 между High Five и Homunculus KR пока не
получил такого подтверждения.**

Здесь «подтверждается» означает, что соответствие явно присутствует в
независимых технических публикациях или исполняемой конфигурации эмулятора.
Официальные клиенты в рамках проверки не запускались, захваты их обмена
не получены. Региональные варианты и точные даты клиентских сборок не следует
добавлять к выводу без отдельного источника.

## Как отбирались доказательства

- Проверялись полные тексты публикаций и содержимое файлов, а не только
  поисковые сниппеты.
- Перепечатки таблицы Akumu и её каталоги клиентов не использовались как
  независимое подтверждение.
- В перечисленных ниже публикациях и файлах не обнаружено ссылок на Akumu.
- В коде проверялось назначение числа: `AllowedProtocolRevisions` действительно
  используется при обработке принятого от клиента `ProtocolVersion`.
- Зеркало L2J Mobius и основной репозиторий считаются одной семьёй источников.
  Несколько публикаций REVERSECODE-TEAM также считаются свидетельствами одного
  автора, а не несколькими независимыми проверками.
- Дата форумной публикации, дата commit и дата выпуска клиента различаются.

## 1. Ревизия 152: подтверждённый пример

### Gracia Epilogue

**Публикация Sarjje на L2jBrasil от 30.07.2010**:

> System desencriptada Gracia Epilogue
>
> protocolo: 152
>
> data da última atualizaçao (via launcher): 30 de julho de 2010

[Полный текст публикации][epilogue-post]. Автор описывает собственную обработку
клиентской system-папки и называет инструменты. Это сообщение о модифицированном
клиенте, а не заверенный оригинальный дистрибутив NCsoft. Последнее отмеченное
редактирование сообщения — январь 2013 года.

В проекте **L2J_Mobius_CT_2.4_Epilogue** также установлено:

```ini
# Default: 152
AllowedProtocolRevisions = 152
```

[Server.ini, строки 68–72][epilogue-config].

### Orfen / Etina's Fate

**Новость L2-Scripts от 17.01.2019** прямо содержит:

> Salvation: Orfen (152 Protocol)

Проверена не только текущая страница, но и её
[сохранённая копия от 01.02.2019][vendor-archive]. В HTML этой копии нет
упоминания Akumu. Публикация посвящена разработке собственных серверных сборок.

В исходниках **L2J_Mobius_5.5_EtinasFate**, сохранённых в commit от
**08.08.2019**, присутствует:

```ini
# Etinas Fate: 152
AllowedProtocolRevisions = 152
```

[Server.ini][etina-config]. В [readme этого проекта][etina-readme]
указана собственная ссылка на клиент в Google Drive, а не ссылка на Akumu.
Дистрибутив по ней в рамках проверки не скачивался.

### Classic Seven Signs

Та же архивная публикация L2-Scripts отдельно указывает
`classic 2.8 (Seven Signs) 152 Protocol`.

В соседнем проекте **L2J_Mobius_Classic_2.3_SevenSigns** того же снимка кода:

```ini
# Seven Signs: 152
AllowedProtocolRevisions = 152
ServerListType = Classic
```

[Server.ini][seven-signs-config]. Числа 2.8 и 2.3 в названиях сборок разных
разработчиков не используются как доказательство официальной нумерации стадий.
Здесь совпадают название Seven Signs и игровая ревизия 152.

### Почему это действительно поле сетевого протокола

В обработчике Epilogue значение читается через `readInt()`, а затем проверяется
через `ServerConfig.PROTOCOL_LIST.contains(_version)` [код][epilogue-handshake].
В Etina's Fate — через `packet.readD()` и
`Config.PROTOCOL_LIST.contains(_version)` [код][etina-handshake].

Таким образом, 152 в этих конфигурациях — разрешённое значение из начального
клиентского пакета, а не версия Java-проекта, номер новости или ID предмета.

### Отличие форматов видно в исходниках

Сравнение двух реализаций `UserInfo`:

| Epilogue                                                                                   | Etina's Fate                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| После идентификатора пакета записываются X, Y, Z, идентификатор транспорта, objectId и имя | После идентификатора пакета записываются objectId, размер, число 24 и маска |
| Далее идёт последовательная запись характеристик                                           | Дальнейшие поля выбираются по `UserInfoType` и маске                        |

Источники: [Epilogue, строки 95–120][epilogue-user-info];
[Etina's Fate, строки 130–167][etina-user-info].

Это конкретное различие сериализации в двух эмуляторах, настроенных на один
номер 152. Оно поддерживает необходимость различать контексты этого номера.
Точные байты официальных клиентов требуют отдельной проверки.

**Граница вывода:** независимо подтверждено соответствие 152 двум разным
поколениям и Classic Seven Signs. Указание NA для каждого исторического клиента
из прежней таблицы этой проверкой отдельно не подтверждено.

## 2. Совпадения между параллельными ветками

Ниже — непосредственно прочитанные конфигурации основного репозитория L2J Mobius.
В каждом файле указано соответствующее значение `AllowedProtocolRevisions`.
Все ссылки закреплены на одном commit; это один независимый от Akumu источник
реализации, а не множество независимых авторов.

| Число | Основная линия                             | Другая ветка                                                                           |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| 28    | [Underground][underground]                 | [Classic Age of Splendor][classic-splendor]                                            |
| 64    | [Helios][helios]                           | [Classic Saviors][classic-saviors]                                                     |
| 110   | [Grand Crusade][grand-crusade]             | [Classic Zaken][classic-zaken]                                                         |
| 140   | [Salvation][salvation]                     | [Classic Antharas][classic-antharas]                                                   |
| 166   | [Fafurion][fafurion]                       | [Classic Secret of Empire][classic-empire]                                             |
| 228   | [Prelude of War][prelude-war]              | [Classic The Kamael][classic-kamael]                                                   |
| 286   | [Homunculus Ch. 2][homunculus]             | [Classic Tales Untold][classic-tales]; [Essence Dwelling of Spirits][essence-dwelling] |
| 311   | [Return of the Queen Ant Ch. 2][queen-ant] | [Essence Frost Lord][frost-lord]                                                       |
| 388   | [Master Class Ch. 3][master-class]         | [Essence Crusader][crusader]                                                           |
| 447   | [Shinemaker][shinemaker]                   | [Essence Seven Signs][essence-seven-signs]                                             |
| 502   | [Superion][superion]                       | [Essence Guardians][guardians]                                                         |
| 507   | [Orc Village][orc-village]                 | [Essence Warg][warg]                                                                   |
| 520   | [Wolf Waker][wolf-waker]                   | [Essence RoseVain][rosevain]                                                           |

Названия оставлены как в соответствующих проектах. Например, код подтверждает
**Classic Tales Untold / 286**; название **Kamael Ch. 5** из Akumu этим
автоматически не подтверждается.

Аналогично, пары Main/Essence для 388 и 447 не подтверждают третью,
Classic-привязку из прежней таблицы. Она требует отдельного источника.

## 3. Ревизия 414: есть стороннее свидетельство, но слабее

В сообщении AlisaCodeDragon / REVERSECODE-TEAM на Gildor's Forums указано
`Goddess of Destruction Awakening Revision/Protocol 414 EU` [публикация][god-414].

В сообщении того же автора на MaxCheaters указано
`LINEAGE2 ESSENCE ASSASSIN Version 414 [Date 07.03.2023][LANG:EUROPE-ORIGINAL]`
[публикация][assassin-414]. Полные тексты обеих страниц прочитаны; ссылок на
Akumu в них нет.

Это свидетельство автора клиентских патчей о двух разных клиентах с номером 414. Но оно относится к изменённым клиентам, поступает от одного автора и
не подкреплено в этом проходе анализом бинарных файлов или захватом обмена.
Статус: **независимая от Akumu заявка, ожидающая технического подтверждения**.

## 4. Что пока не подтверждено независимо

| Предыдущее утверждение                    | Результат этого прохода                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High Five / 273                           | Подтверждено [конфигурацией High Five][high-five]: `267;268;271;273`                                                                                                |
| Homunculus KR / 273                       | Независимого подтверждения не получено; каталог Akumu остаётся единственным проверенным основанием этой конкретной связи                                            |
| Prelude / 377 и современный KR / 377      | Независимое подтверждение современной половины не получено                                                                                                          |
| Gracia Final / 83 и Helios Arena KR / 83  | Независимое подтверждение Arena / 83 не получено                                                                                                                    |
| Gracia Part 1 RU / 19 и Classic Beta / 19 | Полная независимая сверка пары не получена                                                                                                                          |
| Awakening / 415 и Assassin KR / 415       | Для старой половины есть каталог l2clientdev; новая публикация обнаружена только в поисковом индексе, по её адресу сейчас открывается другая страница. Не засчитано |
| C1 / 419 и современный Assassin KR / 419  | Полная независимая сверка новой половины не получена                                                                                                                |

Необнаруженное подтверждение не означает опровержение. В частности, поддержка
286 в проекте Homunculus Ch. 2 не опровергает существование более раннего
корейского клиента 273. Но и подтверждением 273 она не служит.

Для 338, 362, 418, 474 и некоторых стадий из общей таблицы отдельные пары
в этом проходе не закреплены полными независимыми источниками. На них нельзя
распространять результат проверки соседних ревизий.

## Итог для базы знаний

Общий вывод о повторном использовании числовых ревизий **сохраняется на
основании 152**, даже если полностью исключить Akumu. Для проектирования
не требуется объявлять подтверждёнными все остальные примеры.

Связь `273 → Homunculus KR` и другие непроверенные пары должны оставаться
исследовательскими гипотезами. Предыдущая таблица классификации сохраняет
сведения Akumu с указанием происхождения, но не является перечнем полностью
независимо подтверждённых фактов.

## Закреплённые версии исходников

- Основной L2J Mobius: `a4c31517cd0c428783650e008e199f2ac42a8434`, commit от
  27.10.2026. В конфигурациях выше использованы строки 68–72.
- Историческая копия L2J Mobius: `bf4bbe4124497f338cb5ce50c88c06c6280ca50a`,
  дата commit **08.08.2019**, проверенная через GitHub API. Это копия той же
  кодовой базы, а не независимая реализация.

[epilogue-post]: https://www.l2jbrasil.com/topic/29164-gracia-epilogue-patched-system-protocol-152/
[vendor-archive]: https://web.archive.org/web/20190201164527id_/http://l2-scripts.com:80/index.php?news_id=458
[epilogue-config]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_CT_2.4_Epilogue/dist/game/config/Server.ini#L68-72
[etina-config]: https://github.com/w001122/L2J_Mobius/blob/bf4bbe4124497f338cb5ce50c88c06c6280ca50a/L2J_Mobius_5.5_EtinasFate/dist/game/config/Server.ini
[etina-readme]: https://github.com/w001122/L2J_Mobius/blob/bf4bbe4124497f338cb5ce50c88c06c6280ca50a/L2J_Mobius_5.5_EtinasFate/readme.txt
[seven-signs-config]: https://github.com/w001122/L2J_Mobius/blob/bf4bbe4124497f338cb5ce50c88c06c6280ca50a/L2J_Mobius_Classic_2.3_SevenSigns/dist/game/config/Server.ini
[epilogue-handshake]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_CT_2.4_Epilogue/java/org/l2jmobius/gameserver/network/clientpackets/ProtocolVersion.java#L43-61
[etina-handshake]: https://github.com/w001122/L2J_Mobius/blob/bf4bbe4124497f338cb5ce50c88c06c6280ca50a/L2J_Mobius_5.5_EtinasFate/java/org/l2jmobius/gameserver/network/clientpackets/ProtocolVersion.java#L36-L61
[epilogue-user-info]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_CT_2.4_Epilogue/java/org/l2jmobius/gameserver/network/serverpackets/UserInfo.java#L95-120
[etina-user-info]: https://github.com/w001122/L2J_Mobius/blob/bf4bbe4124497f338cb5ce50c88c06c6280ca50a/L2J_Mobius_5.5_EtinasFate/java/org/l2jmobius/gameserver/network/serverpackets/UserInfo.java#L130-L167
[underground]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_02.5_Underground/dist/game/config/Server.ini#L71-72
[classic-splendor]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_1.5_AgeOfSplendor/dist/game/config/Server.ini#L71-72
[helios]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_03.0_Helios/dist/game/config/Server.ini#L71-72
[classic-saviors]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_2.0_Saviors/dist/game/config/Server.ini#L71-72
[grand-crusade]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_04.0_GrandCrusade/dist/game/config/Server.ini#L71-72
[classic-zaken]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_2.5_Zaken/dist/game/config/Server.ini#L71-72
[salvation]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_05.0_Salvation/dist/game/config/Server.ini#L71-72
[classic-antharas]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_2.7_Antharas/dist/game/config/Server.ini#L71-72
[fafurion]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_06.0_Fafurion/dist/game/config/Server.ini#L71-72
[classic-empire]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_2.9_SecretOfEmpire/dist/game/config/Server.ini#L71-72
[prelude-war]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_07.0_PreludeOfWar/dist/game/config/Server.ini#L71-72
[classic-kamael]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_3.0_TheKamael/dist/game/config/Server.ini#L71-72
[homunculus]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_08.2_Homunculus/dist/game/config/Server.ini#L71-72
[classic-tales]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Classic_3.5_TalesUntold/dist/game/config/Server.ini#L71-72
[essence-dwelling]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_04.2_DwellingOfSpirits/dist/game/config/Server.ini#L71-72
[queen-ant]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_09.2_ReturnOfTheQueenAnt/dist/game/config/Server.ini#L71-72
[frost-lord]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_05.2_FrostLord/dist/game/config/Server.ini#L71-72
[master-class]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_10.3_MasterClass/dist/game/config/Server.ini#L71-72
[crusader]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_06.3_Crusader/dist/game/config/Server.ini#L71-72
[shinemaker]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_11.3_Shinemaker/dist/game/config/Server.ini#L71-72
[essence-seven-signs]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_07.3_SevenSigns/dist/game/config/Server.ini#L71-72
[superion]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_12.3_Superion/dist/game/config/Server.ini#L71-72
[guardians]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_08.3_Guardians/dist/game/config/Server.ini#L71-72
[orc-village]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_13.1_OrcVillage/dist/game/config/Server.ini#L71-72
[warg]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_09.1_Warg/dist/game/config/Server.ini#L71-72
[wolf-waker]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_13.2_WolfWaker/dist/game/config/Server.ini#L71-72
[rosevain]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_Essence_09.2_RoseVain/dist/game/config/Server.ini#L71-72
[high-five]: https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/blob/a4c31517cd0c428783650e008e199f2ac42a8434/L2J_Mobius_CT_2.6_HighFive/dist/game/config/Server.ini#L71-72
[god-414]: https://www.gildor.org/smf/index.php?topic=8654.0
[assassin-414]: https://maxcheaters.com/topic/247361-l2-assassin-collection-protocol-%E2%9C%AF414%E2%9C%AF418%E2%9C%AF/
