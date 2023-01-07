'use strict';

import vscode = require('vscode');
// import cp = require('child_process');

import { CancellationToken, CodeLens, commands, languages, Position, Range, TextDocument, Uri } from 'vscode';
// import { getGoConfig } from './config';
// import { GoBaseCodeLensProvider } from './goBaseCodelens';
// import { GoDocumentSymbolProvider } from './goOutline';
// import { getBinPath } from './util';
// import { envPath, getCurrentGoRoot } from './utils/pathUtils';
// import { reject } from 'lodash';

export class ReferenceLensProvider implements vscode.CodeLensProvider {
	
    // 外側から更新する、参照数辞書。このposにこのnumberで参照数lenseを出す。
    private refLenseData = new Array<[Uri, Position, Number]>();


    // private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    
    
	// public get onDidChangeCodeLenses(): vscode.Event<void> {
	// 	return this.onDidChangeCodeLensesEmitter.event;
	// }

	public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
        const codelenses = await Promise.all([
			this.getCodeLensForMainFunc(document, token)
		]);
		return ([] as CodeLens[]).concat(...codelenses);
	}

	
    /*
        // メモ、 vscode.SymbolKind.Function とかの型があっていい感じに応用できそう。
        return this.provideDocumentSymbols(document, token).then((symbols) => {
			return symbols.map((symbol) => {
				let position = symbol.range.start;

				// Add offset for functions as go-outline returns position at the keyword func instead of func name
				if (symbol.kind === vscode.SymbolKind.Function) {
					const funcDecl = document.lineAt(position.line).text.substr(position.character);
					const match = methodRegex.exec(funcDecl);
					position = position.translate(0, match ? match[0].length : 5);
				}
				return new ReferencesCodeLens(document, new vscode.Range(position, position));
			});
		});
    */

    private handle : vscode.Disposable | undefined;

    // update時に呼び出すと何とかしてくれる関数
    public update(refLenseData:[Uri, Position, Number][]) {
        // このインスタンスが持ってる辞書を更新し、lense providerのリロードを行う。
        this.refLenseData = refLenseData;
        
        this.handle?.dispose();
        this.handle = languages.registerCodeLensProvider("*", this);
        
    }

	private async getCodeLensForMainFunc(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
		const mainPromise = async (): Promise<CodeLens[]> => {
            if (this.refLenseData.length === 0) {
                return [];
            }

            let lenses = new Array<CodeLens>();
            this.refLenseData.forEach(data => {
                lenses.push(
                    new CodeLens(new Range(new Position(data[1].line, 0), new Position(data[1].line, 0)), {
                        title: data[2] + ' References',
                        command: 'references-view.findReferences',// super + shift + pからreference~って打って、
                        // VSCodeが提供するfind all ref~について右側の歯車マークを押し、出てくるKeyboard Shortcutsというファイルの上の方に、
                        // @command:@command:references-view.findReferences って書いてあって、もしやと思って採用したらきちんと反応し、レンズを押すとrefsが左画面に出るようになった。
                        arguments: [data[0], data[1]]
                    })
                );
            });

            return lenses;
		};

		return await mainPromise();
	}

    // 使わないが参考にする、ドキュメントから対象を探すやつ。
	// private async function!(
	// 	doc: vscode.TextDocument,
	// 	token: vscode.CancellationToken
	// ): Promise<vscode.DocumentSymbol | undefined> {
	// 	const documentSymbolProvider = new GoDocumentSymbolProvider(true);
	// 	const symbols = await documentSymbolProvider.provideDocumentSymbols(doc, token);
	// 	if (!symbols || symbols.length === 0) {
	// 		return;
	// 	}
	// 	const symbol = symbols[0];
	// 	if (!symbol) {
	// 		return;
	// 	}
	// 	const children = symbol.children;

	// 	return children.find(sym => sym.kind === vscode.SymbolKind.Function && this.mainRegex.test(sym.name));
	// }


}