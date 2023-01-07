// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import * as vscode from 'vscode';
import { CodeLens, commands, languages, Location, Position, Range, Uri, window } from 'vscode';
import {ReferenceLensProvider} from './referenceLenseProvider';

const refProvider = new ReferenceLensProvider();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// このブロックはこの機能の初回起動時に一度だけ発行される。 onLanguageがpackage.jsonについてると勝手に呼ばれそう。-> 呼ばれた、よし。
	
	// find referenceの機能を使うため、vscode goの待ちを行う必要がある。
	// TODO: 現在は本気で適当に待ってるが、もっとちゃんと待ったほうがいい。んでどうやって待てるもんなのこれ。
	console.log("wait start.");
	await new Promise(resolve => setTimeout(resolve, 1000));
	console.log("wait done.");

	// このへんでcode lenseの初期化をし、後々条件を満たしたところに足していく、ということをする。
	
	// 適当に今開いてるgoファイルを対象に動作を行う。
	// TODO: 変更する。
	const uri = vscode.window.activeTextEditor?.document.uri;
	if (uri) {
		// goファイルが保存されたら + goファイルを新たに開いたら実行して、ASTからのレスポンスを得、code lenseを付け直す。
		// TODO: 適切なイベントハンドラのセット
		// TODO: 開発用の決め打ちの破棄

		const currentFileUri = uri;
		const funcStartPositions: Position[] = [
			// ここで指定するのは1行ずれる、14ってやると15行目になる。
			new Position(17, 5)	// 開発用決め打ち
		];

		updateReferenceCodeLenseIfNeed(currentFileUri, funcStartPositions);
		
		// 以下はメモ
		// // The commandId parameter must match the command field in package.json
		// let disposable = vscode.commands.registerCommand('zanthoxylum.helloWorld', () => {
		// 	// なんか右下に表示
		// 	vscode.window.showInformationMessage('右下に表示');
			
		// 	console.log('実行済み');
		// });

		// context.subscriptions.push(disposable);
	}
}

// 件数が0件以上であればcode lenseを更新する。
export function updateReferenceCodeLenseIfNeed(currentFileUri:Uri, funcStartPositions: Position[]) {
	
	if (0 < funcStartPositions.length) {
		const refLenseDataArray = new Array<[Uri, Position, Number]>();

		// 発見したfunctionの数だけ、reference取得を実行し、code lenseを更新する。code lenseはこのイベントの終了を待てばいいのか。
		funcStartPositions.forEach(async startPos => {
				// reference countを出す場所を割り出し、code lenseの位置に表示を出す。
				// TODO: ここにサラッと書いてあるcurrentFileUriは、今は最初に開いたファイルのものなので、on何ちゃらのハンドラで開いたファイルのものにすげ替えないといけない。
				// TODO: このawaitがめちゃくちゃ遅いので、必要なものだけを呼び出すと良いが、ASTのキャッシュとの比較なんてことをしないといけないので後回し。
				const locations = await commands.executeCommand('vscode.executeReferenceProvider', currentFileUri, startPos);
				const l = locations as Array<Location>;
				if (0 < l.length) {
					var refCount = 0;

					// 参照数を集計
					l.forEach(element => {
						// ASTから出したシンボルの位置と食い違うもののみを集計する。
						if (element.range.start.line === startPos.line && element.range.start.character === startPos.character) {
							return;
						}
						
						refCount++;
					});

					// 参照数を保持する。
					refLenseDataArray.push([currentFileUri, startPos, refCount]);
				}
			}
		);

		// レンズのリロードを行う。変更点があったところだけ、、とかが無理なので、全体をリロードする。複数のファイルを開いてる場合も何とかなるのか？
		refProvider.update(refLenseDataArray);
	}
}