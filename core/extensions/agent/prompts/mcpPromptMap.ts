import { agentConfig } from "../core/agentConfig";

const parameterDescriptions = {
	catalogName: "Имя каталога из списка list_catalogs.",
	itemPath:
		"Адрес узла внутри каталога (без catalogName). Статья — guides/setup, раздел — guides/ (хвостовой слэш). Хвостовой слэш — тип узла, а не оформление: без него это статья, и дочерних у неё быть не может, пока она не сконвертирована в раздел. Корень — пустая строка. Без .md и _index.md. Для agent skill — @skills/<имя>.",
	attachmentItemPath:
		"Источник: @attachments/<name.ext> из блока прикрепленных файлов, catalogName/itemPath@resources/<name.ext> из статьи, или http(s) URL.",
	fromLine:
		"Необязательно: номер первой строки фрагмента, нумерация с 1. Без fromLine и toLine документ читается целиком. Только fromLine — от этой строки до конца документа. fromLine вместе с toLine — точный диапазон. Бери число из поля line в результатах поиска; если строка заранее не известна, читай по headingId, а не подбирай диапазон. Нельзя передавать вместе с headingId.",
	toLine: "Необязательно: номер последней строки фрагмента, включительно. Допустим только вместе с fromLine — toLine без fromLine это ошибка. Значение больше длины документа обрезается до последней строки. Нельзя передавать вместе с headingId.",
	regexQuery:
		"Необязательно: true — query разбирается как регулярное выражение JavaScript (шаблоны вида \\d{3}-\\d{2}, TODO|FIXME, ^## ). По умолчанию false — поиск по подстроке. Шаблон применяется ко всему тексту документа. Флаги заданы заранее и переопределить их нельзя: регистр не учитывается (i), ^ и $ — границы строки (m), точка через перевод строки НЕ переходит (s выключен). Групп инлайновых флагов (?i) (?m) (?s) в JavaScript не существует — такой шаблон вернёт ошибку; для многострочного шаблона пиши \\n или [\\s\\S] явно. Группа, внутри которой уже есть * или +, не может повторяться больше одного раза: (a+)+, (\\s*)* и (a+){2} вернут ошибку — такой шаблон может считаться часами. Внешний квантификатор обычно лишний: вместо (a+)+ пиши a+. В поле line указана строка, где совпадение начинается, в text — её текст. Если совпадение захватило несколько строк, в ответе есть ещё endLine и endText — строка, где совпадение заканчивается, и её текст: по ним видно, чем именно шаблон совпал на другом конце.",
	maxHits: `Необязательно: сколько документов вернуть в hits, по умолчанию ${agentConfig.searchHitsDefault}, не больше ${agentConfig.searchHitsMax}: большее значение урезается до ${agentConfig.searchHitsMax}.`,
	readRange:
		"Фрагмент читается двумя способами, вместе они не передаются. По смыслу — headingId: вернётся глава целиком, id бери из оглавления. По адресу — fromLine/toLine: номер строки бери из поля line в результатах поиска, в ответе будут fromLine, toLine и totalLines. Строку уже нашёл поиском — читай по ней, оглавление для этого не нужно.",
} as const;

export const MCP_PROMPT_MAP = {
	browserNavigate: {
		description:
			"Открыть URL в скрытом браузере агента и вернуть новый снимок страницы: url, title, accessibilityTree, isBottomReached.",
		input: {
			url: "Полный URL страницы, начиная с http:// или https://.",
		},
	},
	browserReadPage: {
		description:
			"Получить полный снимок текущей страницы в браузере агента: url, title, accessibilityTree, isBottomReached.",
		input: {},
	},
	browserReadElement: {
		description:
			"Прочитать один интерактивный элемент по elementId из текущего снимка страницы. Возвращает только payload этого элемента.",
		input: {
			elementId: "ID элемента из accessibilityTree.",
		},
	},
	browserClick: {
		description:
			"Кликнуть по интерактивному элементу в браузере агента по elementId и вернуть обновлённый полный снимок страницы после стабилизации.",
		input: {
			elementId: "ID элемента из accessibilityTree.",
		},
	},
	browserType: {
		description:
			"Ввести текст в поле ввода или выбрать значение элемента в браузере агента по elementId и вернуть обновлённый полный снимок страницы после стабилизации.",
		input: {
			elementId: "ID элемента из accessibilityTree.",
			text: "Текст для ввода или значение для выбора.",
		},
	},
	browserScroll: {
		description:
			"Прокрутить текущую страницу в браузере агента вниз и вернуть обновлённый полный снимок страницы после стабилизации.",
		input: {},
	},
	readDocument: {
		description: `Прочитать документ по attachmentItemPath: @attachments/<name.ext>, catalogName/itemPath@resources/<name.ext> или http(s) URL. Ответ: content — текст. Без headingId и без диапазона — весь файл; с headingId (chunk~1, section-chunk~1, …) — чанк. Не все типы файлов можно прочитать как текст. ${parameterDescriptions.readRange}`,
		tooLarge: "Документ слишком большой. Возьми data.headings из этого ответа и повтори с более узким headingId.",
		rangeTooLarge:
			"Фрагмент слишком большой. Повтори с более узким диапазоном fromLine/toLine — длина документа в data.totalLines.",
		input: {
			attachmentItemPath: parameterDescriptions.attachmentItemPath,
			headingId:
				"Необязательно: используй только если чтение всего файла вернуло ошибку. id чанка для чтения (chunk~1, section-chunk~1, …).",
			fromLine: parameterDescriptions.fromLine,
			toLine: parameterDescriptions.toLine,
		},
	},
	transcribeAudio: {
		description: "Транскрибация аудио/видео через Nexara API по attachmentItemPath. Нужен секрет NEXARA_API_KEY.",
		input: {
			attachmentItemPath: `${parameterDescriptions.attachmentItemPath} Только аудио/видео.`,
		},
	},
	listCatalogs: {
		description: "Список имён каталогов Gramax. Первый шаг навигации. Ответ: список каталогов (name, title).",
	},
	readCatalogItem: {
		description: `Прочитать узел каталога Gramax (статью или раздел). Без headingId и без диапазона — полный markdown. С headingId из get_catalog_item_headings — глава или её чанк (id вида section-chunk~1). ${parameterDescriptions.readRange}`,
		tooLarge: "Документ слишком большой. Возьми data.headings из этого ответа и повтори с более узким headingId.",
		rangeTooLarge:
			"Фрагмент слишком большой. Повтори с более узким диапазоном fromLine/toLine — длина документа в data.totalLines.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
			headingId:
				"Необязательно: id заголовка из get_catalog_item_headings или из data.headings предыдущего ответа. Вернётся глава целиком, вместе с подзаголовками.",
			fromLine: parameterDescriptions.fromLine,
			toLine: parameterDescriptions.toLine,
		},
	},
	getCatalogItemHeadings: {
		description:
			"Иерархия заголовков и чанков больших секций в статье/разделе. Ответ: дерево headings (id, level, title, children). Большие главы без детей разбиваются на id-chunk~1, id-chunk~2; у больших глав с детьми — читай дочерние id.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
		},
	},
	searchCatalogs: {
		description: `Поиск по статьям и разделам каталогов Gramax. Ответ: hits (catalogName, itemPath, title, matches) и hasMore — поле есть только когда выдано не всё — либо найдено больше maxHits, либо обход прерван по времени: повтори с большим maxHits или сузь запрос. matches — список совпадений вида { line, text }: line — номер строки, который можно передать в read_catalog_item как fromLine, text — сама строка. catalogName и itemPath — для аргументов других инструментов, title для контекста. Два режима. regex=false (по умолчанию) — тот же движок, что поиск в интерфейсе: находит и по части слова, прощает опечатки и неверную раскладку, учитывает словоформы. В query пиши ключевые слова, которые должны встретиться в тексте статьи, а не вопрос целиком; поддерживаются "точная фраза" в кавычках, -слово для исключения и +слово для обязательного. Если совпадение найдено по словоформе, а не буквально, у него line=null. regex=true — точный поиск по шаблону без учёта словоформ, ТРЕБУЕТ catalogName. Шаблон применяется к исходному тексту документа, а не к тому, что вернёт чтение: раскрытые диаграммы и текст комментариев в поиск не попадают, а ссылки видны в исходном виде. Если совпавшая строка при чтении выглядит иначе, у совпадения будет line=null.`,
		input: {
			query: 'Ключевые слова (поддерживаются "фраза", -исключение, +обязательное слово) или, при regex=true, регулярное выражение.',
			catalogName:
				"Ограничить одним каталогом из list_catalogs. Без параметра — поиск по всем каталогам. При regex=true параметр обязателен.",
			regex: parameterDescriptions.regexQuery,
			maxHits: parameterDescriptions.maxHits,
		},
	},
	getNavigation: {
		description:
			"Полное дерево навигации каталога. Ответ: root + tree с рекурсивными children; у каждого узла type, itemPath, title (itemPath — для аргументов инструментов, title — заголовок для контекста). Без itemPath — дерево от корня.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: `Необязательно. ${parameterDescriptions.itemPath}`,
		},
	},
	deleteCatalogItem: {
		description:
			"Удалить статью или категорию (необратимо). Категория удаляется иерархически: вместе с вложенными подкатегориями и статьями. Если нужно удалить всё содержимое раздела, удаляй сам раздел одним вызовом. Успех: JSON с itemPath.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
		},
	},
	moveCatalogItem: {
		description:
			"Перенести статью или категорию в пределах каталога. Для категории — рекурсивно со всем содержимым. Передавай конечный toItemPath целиком. Если занят — ошибка, без переноса. Статья→раздел: toItemPath со слэшем; обратное не поддерживается. Родитель в toItemPath обязан быть разделом: если это статья, сначала преобразуй её этим же инструментом (fromItemPath и toItemPath — её путь, второй со слэшем), затем повтори перенос для будущих дочерних элементов.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			fromItemPath: parameterDescriptions.itemPath,
			toItemPath: parameterDescriptions.itemPath,
		},
	},
	createCatalogItem: {
		description:
			"Создать пустую статью или подкатегорию. Тип — из itemPath (слэш = раздел). Последний сегмент itemPath — имя файла; title — заголовок узла. Новый узел встаёт последним среди соседей, order задавать не нужно. Успех: type, itemPath, content — content уже содержит frontmatter, дополни документ через write_catalog_item.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
			title: "Заголовок нового узла.",
		},
	},
	writeCatalogItem: {
		description:
			"Крупные патчи в существующей статье или разделе. Два режима: с headingId — переписать одну главу (раздел по ATX-заголовку) вместе с подзаголовками; без headingId — переписать весь документ. При ошибке парсинга текст не обновляется. Успех: JSON с itemPath (и headingId, если передан).",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
			content:
				"Новый markdown. С headingId — только текст главы, как в read_catalog_item с тем же headingId: строка заголовка главы и её содержимое до следующего заголовка того же или более высокого уровня. Без headingId — полный документ с frontmatter.",
			headingId: "Необязательно: id заголовка из get_catalog_item_headings для замены одной главы.",
		},
	},
	replaceCatalogItem: {
		description:
			"Точечная текстовая замена в статье или разделе по шаблону oldText -> newText. Используй для небольших правок по точному совпадению (строка, фрагмент). Для переписывания целой главы — write_catalog_item с headingId; для всего документа — write_catalog_item без headingId. Обязательный флаг replaceAll: false — ровно одна замена (если найдено больше 1 вхождения, инструмент вернет ошибку), true — массовая замена всех вхождений. При ошибке парсинга текст статьи не обновляется. Успех: JSON с itemPath, replacedCount, replaceAll.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			itemPath: parameterDescriptions.itemPath,
			oldContent: `Точный текст для поиска и замены, не может быть пустым. Копируй текст из результата read_catalog_item буквально, символ в символ. НИКОГДА не применяй HTML-экранирование (&lt;, &gt;, &amp;) к <, >, & внутри oldContent и newContent.`,
			newContent: `Текст замены.`,
			replaceAll:
				"Обязательный флаг массовости: true — заменить все вхождения, false — заменить только одно. При false и количестве вхождений > 1 инструмент вернет ошибку.",
		},
	},
	saveChatAttachment: {
		description:
			"Скопировать вложение чата рядом со статьёй/разделом. Markdown в статью не вставляет. Успех: href и markdown — вставь сниппет через write_catalog_item или replace_catalog_item.",
		input: {
			attachmentItemPath: "Источник: @attachments/<name.ext> из блока прикрепленных файлов.",
			catalogName: parameterDescriptions.catalogName,
			targetItemPath:
				"Куда положить файл: статья — guides/setup, раздел — guides/, корень каталога — пустая строка.",
		},
	},
	getFilesNavigation: {
		description:
			"Список файлов и директорий внутри директории репозитория каталога. Ответ: root + tree с children; у каждого узла type, path, name (path — для аргументов read_file и get_files_navigation).",
		input: {
			catalogName: parameterDescriptions.catalogName,
			dirPath:
				"Необязательная стартовая директория: путь относительно корня каталога. Если не указан — список строится от корня каталога.",
		},
	},
	searchFiles: {
		description: `Поиск по текстовым файлам репозитория каталога, включая служебные файлы и исходники статей в формате хранения. Бинарные файлы, изображения, pdf, docx и xlsx не просматриваются. Файлы идут в порядке обхода директорий, без ранжирования. Для поиска по статьям и разделам используй search_catalogs. Ответ: hits (catalogName, filePath, matches) и hasMore — поле есть только когда выдано не всё — либо найдено больше maxHits, либо обход прерван по времени: повтори с большим maxHits или сузь запрос. matches — список совпадений вида { line, text }: line — номер строки, который можно передать в read_file как fromLine, text — сама строка. При regex=false совпадение буквальное и без учёта регистра: без морфологии и без разбиения на слова, несколько слов ищутся как одна фраза подряд; словоформы покрывай основой слова («настро» найдёт «настройка» и «настроить»).`,
		input: {
			query: "Искомая подстрока — ищется буквально, без учёта регистра — или, при regex=true, регулярное выражение.",
			catalogName: parameterDescriptions.catalogName,
			maxMatches:
				"Необязательно: сколько совпадений возвращать внутри одного файла, от 1 до 3. Если не передан — 1. Проси больше одного только когда нужен контекст нескольких вхождений в одном файле.",
			regex: parameterDescriptions.regexQuery,
			maxHits: parameterDescriptions.maxHits,
		},
	},
	readFile: {
		description: `Прочитать файл из репозитория каталога. Без headingId и без диапазона — полный текст; с headingId из data.headings — чанк. ${parameterDescriptions.readRange}`,
		tooLarge: "Файл слишком большой. Возьми data.headings из этого ответа и повтори с более узким headingId.",
		rangeTooLarge:
			"Фрагмент слишком большой. Повтори с более узким диапазоном fromLine/toLine — длина файла в data.totalLines.",
		input: {
			catalogName: parameterDescriptions.catalogName,
			filePath: "Путь к файлу относительно корня каталога.",
			headingId: "Необязательно: используй только если чтение всего файла вернуло ошибку.",
			fromLine: parameterDescriptions.fromLine,
			toLine: parameterDescriptions.toLine,
		},
	},
	gitInspect: {
		description:
			"Просмотр git без изменений репозитория. status — текущие изменения; log — история коммитов; diff — сравнение версий или дифф файла. Сначала status/log, затем diff с oid из log.",
		input: {
			catalogName: "Имя каталога.",
			action: "status | log | diff.",
			filePath:
				"Необязательно: путь файла. Для log — история файла; для diff — hunks этого файла (без filePath — список файлов).",
			limit: "Необязательно для log: сколько коммитов вернуть (по умолчанию 20).",
			from: "Необязательно для diff: oid коммита из git_inspect log. Без from и to — workdir vs HEAD.",
			to: "Необязательно для diff: oid из log или workdir. По умолчанию workdir. Если to — oid, from обязателен.",
		},
	},
	gitDiscard: {
		description:
			"Откатить изменения (и staged, и unstaged): если передан filePaths — откатить только эти файлы, если filePaths не передан — откатить все изменения каталога. Инструмент destructive.",
		input: {
			catalogName: "Имя каталога, где нужно откатить изменения.",
			filePaths:
				"Необязательно: список путей файлов. Если не передан — действие применяется ко всем staged+unstaged изменениям в каталоге.",
		},
	},
	gitBranch: {
		description:
			"Ветки git. branches — список (name, oid, remote, current); checkout — переключить (destructive). Сначала branches; oid из ответа — для git_inspect/git_restore.",
		input: {
			catalogName: "Имя каталога.",
			action: "branches | checkout.",
			branch: "Для checkout: имя ветки из branches.",
		},
	},
	gitRestore: {
		description:
			"Записать в workdir файлы из коммита from (oid из log/branches; HEAD не двигается). С filePaths — частично, без — все отличающиеся. Destructive. Незакоммиченное к HEAD — git_discard.",
		input: {
			catalogName: "Имя каталога.",
			from: "Oid коммита из git_inspect log или git_branch branches.",
			filePaths: "Необязательно: пути файлов. Без поля — полный откат к from.",
		},
	},
	httpRequest: {
		description:
			"HTTP-запрос к внешнему API (аналог curl). ИСПОЛЬЗУЙ С ОСТОРОЖНОСТЬЮ. Текстовый ответ: status, statusText, ok, body. Бинарный ответ сохраняется как вложение сессии: status, ok, attachmentItemPath (@attachments/<name.ext>), mime, size.",
		input: {
			url: "Полный URL, начинается с http:// или https://.",
			method: "Необязательно: метод запроса.",
			headers: 'Необязательно: объект HTTP-заголовков, например {"Authorization": "Bearer token"}.',
			body: "Необязательно: тело запроса строкой.",
			auth: "Необязательно: HTTP Basic, как curl -u. Объект { username, password }; заголовок Authorization кодируется сам. Для Bearer используй headers.",
		},
	},
	mailRequest: {
		description:
			"Запрос к IMAP/SMTP (аналог curl --url imaps:// / smtps://). ИСПОЛЬЗУЙ С ОСТОРОЖНОСТЬЮ. Схема url задаёт протокол. Ответ: status, statusText, ok, body — сырой текст сервера, truncated.",
		input: {
			url: "Полный URL: imaps://host[:port]/mailbox или smtps://host[:port]. Порт можно опустить.",
			command: "Необязательно. IMAP-команда без тега, например UID SEARCH UNSEEN. Для SMTP не передавай.",
			body: "Необязательно. SMTP: RFC822-письмо.",
			auth: "Необязательно: { username, password }. LOGIN/AUTH кодируется сам. Для секретов — плейсхолдеры.",
		},
	},
	searchWeb: {
		description:
			"Поиск в интернете через внешний search API. Используй вместо сырого http_request, когда нужно найти веб-страницы по запросу. Ответ: query, results[{title, url}].",
		input: {
			query: "Поисковый запрос в свободной форме.",
			limit: "Необязательно: количество результатов. Если не передан, используется лимит по умолчанию.",
		},
	},
	compactContext: {
		description:
			"Сжать контекст диалога: история заменяется кратким summary плюс последние сообщения пользователя. Вызывай, когда пользователь явно просит суммаризировать/сжать/компактировать контекст или историю диалога. Сжатие произойдёт перед следующим шагом модели.",
		input: {},
	},
} as const;
