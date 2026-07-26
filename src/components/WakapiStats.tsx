import React, { useEffect, useState } from 'react';
import {
  SiGo,
  SiGoland,
  SiJson,
  SiMarkdown, SiReact,
  SiTypescript,
  SiWebstorm, SiYaml
} from '@icons-pack/react-simple-icons';
import VSCodeLogo from '@/components/icons/VSCodeLogo.astro';
import { LoaderCircle } from 'lucide-react';

export default function WakapiStats() {
  const [languages, setLanguages] = useState<Stat[]>([]);
  const [editors, setEditors] = useState<Stat[]>([]);

  // Colors for some languages, others will use a default gray color
  const languagesData: {
    [key: string]: {
      color: string;
      logo: React.ComponentType<React.SVGProps<SVGSVGElement>> | null;
    }
  } = {
    Go: {
      color: '#00ADD8',
      logo: SiGo,
    },
    TypeScript: {
      color: '#3178C6',
      logo: SiTypescript,
    },
    TSX: {
      color: '#3178C6',
      logo: SiTypescript,
    },
    JSX: {
      color: '#F7DF1E',
      logo: SiReact,
    },
    Markdown: {
      color: '#000000',
      logo: SiMarkdown,
    },
    Mdx: {
      color: '#000000',
      logo: SiMarkdown,
    },
    Powershell: {
      color: '#012456',
      logo: null,
    },
    JSON: {
      color: '#292929',
      logo: SiJson,
    },
    YAML: {
      color: '#cb171e',
      logo: SiYaml,
    },
  };
  const editorsData = {
    Webstorm: {
      color: '#000000',
      logo: SiWebstorm,
    },
    Vscode: {
      color: '#007ACC',
      logo: VSCodeLogo,
    },
    Goland: {
      color: '#00ADD8',
      logo: SiGoland,
    },
  };

  useEffect(() => {
    fetch('https://wakapi.tenshii.moe/api/v1/users/Tenshii/stats')
      .then((res) => res.json())
      .then((data: {
        data: {
          languages: Stat[];
          editors: Stat[];
        };
      }) => {
        setLanguages(data.data.languages);

        const ignoredEditors = data.data.editors.filter(e => e.percent <= 2);
        setEditors([
          ...data.data.editors.filter(e => e.percent > 2),
          {
            name: 'Other',
            percent: ignoredEditors.reduce((acc, curr) => acc + curr.percent, 0),
            text: ignoredEditors.map(e => e.name).join(', '),
          },
        ]);
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 pt-28" id="stats">
      <h2 className="text-3xl font-bold text-center mb-4">Programming Stats</h2>
      <p className="text-center mb-8 text-sm text-gray-300">
        Data tracked since July 2025 using <a href="https://github.com/muety/wakapi" target="_blank" rel="noreferrer">Wakapi</a>, an open-source alternative to WakaTime.
      </p>

      <div className="max-w-7xl mx-auto">
        {languages.length === 0 ? (
          <div className="animate-pulse flex items-center gap-2 justify-center">
            <LoaderCircle className="animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {languages.slice(0, 9).map((lang) => {
              const langInfo = languagesData[lang.name] || { color: '#6b7280', logo: null };

              return (
                <div key={lang.name}>
                  <div className="flex justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {langInfo.logo ? <langInfo.logo width={20} height={20} color={langInfo.color} /> : null}
                      <span className="font-medium">{lang.name}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{lang.text}</span>
                    </div>
                    <span className="text-sm font-medium">{lang.percent.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                    <div
                      className="h-4 rounded-full"
                      style={{ width: `${lang.percent}%`, backgroundColor: langInfo.color || '#6b7280' }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {editors.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Editors</h3>
            <div className="mb-3 flex flex-wrap justify-center gap-2 md:gap-8">
              {editors.slice(0, 9).map((editor) => {
                // @ts-ignore
                const editorInfo = editorsData[editor.name] || { color: '#6b7280', logo: null };

                return (
                  <div key={editor.name}>
                    <div className="flex items-center justify-center gap-2 h-8">
                      {editorInfo.logo ? <editorInfo.logo size={24} width={24} height={24} color={editorInfo.color} /> : null}
                      <span className="text-sm font-medium text-blue-700 dark:text-white">
                        {editor.name} ({editor.percent.toFixed(2)}%)
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 text-center mt-2">{editor.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="w-full bg-gray-200 rounded-full h-6 dark:bg-gray-700 flex overflow-hidden">
              {editors.slice(0, 9).map((editor) => {
                // @ts-ignore
                const editorInfo = editorsData[editor.name] || { color: '#6b7280', logo: null };

                return (
                  <div
                    key={editor.name} className="h-6" title={`${editor.name}: ${editor.percent.toFixed(2)}%`}
                    style={{ width: `${editor.percent}%`, backgroundColor: editorInfo.color, }}
                  ></div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface Stat {
  name: string;
  percent: number;
  // Formatted time spent, e.g. "1 hr 23 mins"
  text: string;
}
