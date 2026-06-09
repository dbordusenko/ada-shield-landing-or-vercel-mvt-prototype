import { Card } from '@/components/ui/card';

interface TeamMember {
  initials: string;
  name: string;
  role: string;
  department: string;
  description: string;
  traits: string[];
  avatarColor: string;
  tagColor: string;
}

const teamMembers: TeamMember[] = [
  {
    initials: 'BA',
    name: 'Bobby Axelrod',
    role: 'Chief Strategy Officer',
    department: 'Strategy',
    description:
      'Амбициозный инвестор с чутьём на нестандартные ходы. Видит рынок на несколько шагов вперёд, формирует сильные команды и адаптируется к любой ситуации.',
    traits: ['Стратегическое мышление', 'Харизматичный лидер', 'Интуиция'],
    avatarColor: 'bg-blue-600',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    initials: 'W',
    name: 'Венди',
    role: 'Chief People Officer',
    department: 'Люди',
    description:
      'Психолог-коуч, мастер мотивации. Раскрывает потенциал каждого члена команды и умело балансирует личные амбиции сотрудников с корпоративными целями.',
    traits: ['Эмоциональный интеллект', 'Коучинг', 'Мотивация'],
    avatarColor: 'bg-purple-600',
    tagColor: 'bg-purple-100 text-purple-700',
  },
  {
    initials: 'BL',
    name: 'Bobby Lane',
    role: 'Chief Data Officer',
    department: 'Данные',
    description:
      'Молодой аналитик, влюблённый в большие данные. Глубоко погружается в цифры, строит алгоритмы оптимизации и превращает сырые данные в точные решения.',
    traits: ['Big Data', 'Алгоритмы', 'Аналитика'],
    avatarColor: 'bg-cyan-600',
    tagColor: 'bg-cyan-100 text-cyan-700',
  },
  {
    initials: 'L',
    name: 'Лара',
    role: 'Chief Communications Officer',
    department: 'Коммуникации',
    description:
      'Связующее звено всей команды. Строит доверие между людьми, объединяет отделы и обеспечивает прозрачный обмен информацией внутри и снаружи компании.',
    traits: ['Доверие', 'Связи между людьми', 'Синергия'],
    avatarColor: 'bg-orange-500',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  {
    initials: 'M',
    name: 'Майк',
    role: 'Chief Financial Officer',
    department: 'Финансы',
    description:
      'Жёсткий финансист с железной дисциплиной. Опирается исключительно на факты и цифры, контролирует бюджеты и держит под прицелом каждый финансовый риск.',
    traits: ['Бюджетный контроль', 'Управление рисками', 'Точность'],
    avatarColor: 'bg-gray-700',
    tagColor: 'bg-gray-100 text-gray-700',
  },
  {
    initials: 'A',
    name: 'Анна',
    role: 'Chief Revenue Officer',
    department: 'Продажи',
    description:
      'Харизматичный драйвер роста. Тонко чувствует потребности клиентов, выстраивает долгосрочные партнёрства и стабильно генерирует выручку для всей команды.',
    traits: ['Клиентоориентированность', 'Долгосрочные отношения', 'Рост'],
    avatarColor: 'bg-green-600',
    tagColor: 'bg-green-100 text-green-700',
  },
];

export default function TeamSection() {
  return (
    <section className="py-20 max-w-6xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-semibold">Команда экспертов</h2>
        <p className="text-gray-500 mt-3 max-w-xl mx-auto">
          Шесть специалистов, каждый отвечает за свой блок: стратегия, люди, данные,
          коммуникации, финансы и продажи.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map((member) => (
          <Card
            key={member.name}
            className="p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div
                className={`${member.avatarColor} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                aria-hidden="true"
              >
                {member.initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
            </div>
            <span
              className={`${member.tagColor} text-xs font-medium px-2.5 py-1 rounded-full self-start`}
            >
              {member.department}
            </span>
            <p className="text-sm text-gray-600 leading-relaxed">{member.description}</p>
            <div className="flex flex-wrap gap-2 mt-auto">
              {member.traits.map((trait) => (
                <span
                  key={trait}
                  className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded"
                >
                  {trait}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
