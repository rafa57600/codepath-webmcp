import type { Course } from '../types';

export const javascriptCourse: Course = {
  id: 'javascript',
  title: 'JavaScript',
  status: 'available',
  color: '#f7df1e',
  lessons: [
    {
      id: 'introduction',
      title: 'Introduction to JavaScript',
      objective: 'Understand what JavaScript is and how it makes webpages interactive.',
      summary:
        'JavaScript is a programming language that makes webpages do things instead of staying static. It responds to user actions like clicks and keystrokes.',
      simpleExplanation: [
        'JavaScript is a programming language used to make webpages do things instead of remaining static.',
        'Websites written with JavaScript can respond to the person using them.',
      ],
      concepts: ['What is JavaScript', 'Why it matters', 'Running your first code'],
      visualType: 'interaction',
      examples: [
        {
          title: 'Your very first line of JavaScript',
          code: 'console.log("Hello, JavaScript!");',
          explanation:
            'console.log() prints a message to the developer console. The text inside the quotes is what gets displayed.',
        },
      ],
      tryIt: {
        title: 'Try it yourself',
        starterCode: 'console.log("Hello!");',
        expectedOutput: ['Hello!'],
      },
      exercises: [
        {
          id: 'introduction-1',
          title: 'Change the message',
          instructions: 'Modify the code so it outputs: I am learning JavaScript!',
          starterCode: 'console.log("Hello!");',
          difficulty: 'beginner',
          hint: 'Keep console.log(...) — only change the text inside the quotes.',
          tests: [
            {
              id: 'outputs-correct-text',
              description: 'Outputs exactly "I am learning JavaScript!"',
              run: 'outputs.join("\\n") === "I am learning JavaScript!"',
            },
          ],
        },
        {
          id: 'introduction-2',
          title: 'Name the language',
          instructions: 'Write JavaScript that outputs the single word: JavaScript',
          starterCode: 'console.log(______);',
          difficulty: 'beginner',
          hint: 'The message must be inside quotation marks.',
          tests: [
            {
              id: 'outputs-javascript',
              description: 'Outputs exactly "JavaScript"',
              run: 'outputs.join("\\n") === "JavaScript"',
            },
          ],
        },
      ],
      quiz: {
        question: 'What is JavaScript commonly used for on websites?',
        options: [
          { id: 'a', text: 'Changing the color of your computer' },
          { id: 'b', text: 'Making webpages interactive' },
          { id: 'c', text: 'Creating PDF files only' },
          { id: 'd', text: 'Running the Windows operating system' },
        ],
        correctId: 'b',
        explanation:
          'JavaScript makes webpages respond to the user: clicks, text changes, messages and calculations.',
      },
    },
    {
      id: 'variables',
      title: 'Variables',
      objective: 'Understand how JavaScript stores information.',
      summary:
        'A variable is like a labeled box that holds a value. You create one with let and give it a name and a value.',
      simpleExplanation: [
        'A variable is like a labeled box that contains a value.',
        'You write a label (the name), then place a value inside the box.',
      ],
      concepts: ['What is a variable', 'let', 'Strings vs numbers'],
      visualType: 'variable-box',
      examples: [
        {
          title: 'Storing two kinds of values',
          code: 'let language = "JavaScript";\nlet year = 2026;',
          explanation:
            'language holds text, so it uses quotation marks. year holds a number, so it does not need quotes.',
        },
      ],
      tryIt: {
        title: 'Try it yourself',
        starterCode: 'let name = "Alex";\n\nconsole.log(name);',
        expectedOutput: ['Alex'],
        hint: 'You can change "Alex" to your own name and press Run.',
      },
      exercises: [
        {
          id: 'variables-1',
          title: 'Store a city',
          instructions: 'Create a variable named city that contains the string "Paris".',
          starterCode: 'let city = ___;',
          difficulty: 'beginner',
          hint: 'Paris is text, so it belongs inside quotation marks.',
          tests: [
            {
              id: 'city-defined',
              description: 'A variable named city exists',
              run: 'typeof city !== "undefined"',
            },
            {
              id: 'city-value',
              description: 'city is the string "Paris"',
              run: 'city === "Paris"',
            },
          ],
        },
        {
          id: 'variables-2',
          title: 'Store a number',
          instructions: 'Create a variable named age that contains the number 25.',
          starterCode: 'let age = ___;',
          difficulty: 'beginner',
          hint: 'A number does not need quotation marks.',
          tests: [
            {
              id: 'age-defined',
              description: 'A variable named age exists',
              run: 'typeof age !== "undefined"',
            },
            {
              id: 'age-value',
              description: 'age is the number 25',
              run: 'age === 25 && typeof age === "number"',
            },
          ],
        },
      ],
      quiz: {
        question: 'Which line stores text correctly?',
        options: [
          { id: 'a', text: 'let name = Adam;' },
          { id: 'b', text: 'let name = "Adam";' },
        ],
        correctId: 'b',
        explanation: 'Text (strings) must be written between quotation marks.',
      },
    },
    {
      id: 'conditions',
      title: 'Conditions',
      objective: 'Understand how programs make decisions.',
      summary:
        'Conditions let JavaScript choose what to do depending on whether something is true or false.',
      simpleExplanation: [
        'Conditions allow JavaScript to choose what to do depending on whether something is true or false.',
        'An if statement runs a block only when its condition is true; else runs an alternative block.',
      ],
      concepts: ['if', 'else', 'Comparison operators (>=, >, ===)'],
      visualType: 'condition-tree',
      examples: [
        {
          title: 'Making a decision',
          code: 'let age = 20;\n\nif (age >= 18) {\n  console.log("Adult");\n} else {\n  console.log("Minor");\n}',
          explanation: 'Because age is 20, which is at least 18, "Adult" is printed.',
        },
        {
          title: 'Pass or fail',
          code: 'let score = 40;\n\nif (score >= 50) {\n  console.log("Passed");\n} else {\n  console.log("Failed");\n}',
          explanation: 'A score below 50 falls into the else branch, printing "Failed".',
        },
      ],
      tryIt: {
        title: 'Try it yourself',
        starterCode:
          'let score = 75;\n\nif (score >= 50) {\n  console.log("Passed");\n} else {\n  console.log("Failed");\n}',
        expectedOutput: ['Passed'],
        hint: 'Try changing 75 to 30 and see how the result changes.',
      },
      exercises: [
        {
          id: 'conditions-1',
          title: 'Check adulthood',
          instructions:
            'Complete the condition so the program prints "Adult" when age is at least 18.',
          starterCode:
            'let age = 20;\n\nif (__________) {\n  console.log("Adult");\n}',
          difficulty: 'beginner',
          hint: 'Use the >= operator to compare age with 18.',
          tests: [
            {
              id: 'prints-adult',
              description: 'Prints "Adult" when age is 20',
              run: 'outputs.join("\\n") === "Adult"',
            },
          ],
        },
        {
          id: 'conditions-2',
          title: 'Hot or normal',
          instructions:
            'If temperature is greater than 30, print "Hot". Otherwise print "Normal".',
          starterCode: 'let temperature = 35;\n\n// Write your condition here',
          difficulty: 'beginner',
          hint: 'Use an if/else pair. The condition compares temperature with 30.',
          tests: [
            {
              id: 'prints-hot',
              description: 'Prints "Hot" when temperature is 35',
              run: 'outputs.join("\\n") === "Hot"',
            },
            {
              id: 'prints-normal-cold',
              description: 'Prints "Normal" when temperature is below 30',
              run: 'true',
            },
          ],
        },
      ],
      quiz: {
        question: 'What does an if statement do?',
        options: [
          { id: 'a', text: 'It repeats code' },
          { id: 'b', text: 'It stores a value' },
          { id: 'c', text: 'It runs code only when a condition is true' },
          { id: 'd', text: 'It closes the program' },
        ],
        correctId: 'c',
        explanation: 'An if statement runs a block of code only when its condition evaluates to true.',
      },
    },
    {
      id: 'loops',
      title: 'Loops',
      objective: 'Understand how JavaScript repeats instructions.',
      summary:
        'A loop repeats the same block of code many times. The for loop has three parts: start, condition, and step.',
      simpleExplanation: [
        'Loops let JavaScript repeat instructions instead of writing them over and over.',
        'This repetitive task:',
      ],
      concepts: ['for loop', 'i++', 'The three parts of a for loop'],
      visualType: 'loop-flow',
      examples: [
        {
          title: 'Shortcut for repetition',
          code: 'console.log(1);\nconsole.log(2);\nconsole.log(3);\nconsole.log(4);\nconsole.log(5);',
          explanation: 'Writing this out is tedious. A loop does the same in far fewer lines.',
        },
        {
          title: 'The for loop',
          code: 'for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}',
          explanation:
            'let i = 1 starts at 1. i <= 5 keeps going while i is at most 5. i++ adds 1 after each round.',
        },
      ],
      tryIt: {
        title: 'Try it yourself',
        starterCode: 'for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}',
        expectedOutput: ['1', '2', '3'],
        hint: 'Change the 3 to another number and watch how many lines print.',
      },
      exercises: [
        {
          id: 'loops-1',
          title: 'Print 1 to 5',
          instructions: 'Use a for loop to print the numbers 1 through 5.',
          starterCode: 'for (let i = 1; __________; i++) {\n  console.log(i);\n}',
          difficulty: 'beginner',
          hint: 'The loop should continue while i is less than or equal to 5.',
          tests: [
            {
              id: 'prints-1-to-5',
              description: 'Prints exactly 1, 2, 3, 4, 5',
              run: 'outputs.join("\\n") === "1\\n2\\n3\\n4\\n5"',
            },
          ],
        },
        {
          id: 'loops-2',
          title: 'Print 1 to 10',
          instructions: 'Print the numbers from 1 through 10 using a for loop.',
          starterCode: 'for (let i = 1; i <= 10; i++) {\n  console.log(i);\n}',
          difficulty: 'beginner',
          hint: 'Same loop shape, just a different upper limit.',
          tests: [
            {
              id: 'prints-1-to-10',
              description: 'Prints 10 lines from 1 to 10',
              run: 'outputs.length === 10 && outputs[9] === "10"',
            },
          ],
        },
        {
          id: 'loops-3',
          title: 'Print even numbers',
          instructions: 'Print the even numbers from 2 through 10.',
          starterCode: '// Print 2, 4, 6, 8, 10',
          difficulty: 'intermediate',
          hint: 'Start at 2 and add 2 each time: i += 2.',
          tests: [
            {
              id: 'prints-evens',
              description: 'Prints exactly 2, 4, 6, 8, 10',
              run: 'outputs.join("\\n") === "2\\n4\\n6\\n8\\n10"',
            },
          ],
        },
      ],
      quiz: {
        question: 'What does i++ do?',
        options: [
          { id: 'a', text: 'It sets i to zero' },
          { id: 'b', text: 'It increases i by 1' },
          { id: 'c', text: 'It ends the loop' },
          { id: 'd', text: 'It prints i' },
        ],
        correctId: 'b',
        explanation: 'i++ is shorthand for i = i + 1. It adds 1 to i after each round.',
      },
    },
  ],
};

export const courses: Course[] = [
  javascriptCourse,
  {
    id: 'python',
    title: 'Python',
    status: 'coming-soon',
    color: '#3776ab',
    lessons: [],
  },
  {
    id: 'html-css',
    title: 'HTML/CSS',
    status: 'coming-soon',
    color: '#e34c26',
    lessons: [],
  },
];
