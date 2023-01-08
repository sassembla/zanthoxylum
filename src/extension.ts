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

	// activate時にcode lenseを出す。
	await reload();

	// コマンドでのreloadの登録
	{
		let disposable = vscode.commands.registerCommand('zanthoxylum.reload', async () => {
			// 右下に表示
			vscode.window.showInformationMessage('zanthoxylum: Reference Reloaded.');
			await reload();
		});

		// コマンド登録
		context.subscriptions.push(disposable);
	}

	// ファイル開いた時のイベント登録
	{
		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (e) => {
			if (e) {
				await reload();
			}
		}));
	}

	{
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (e) => {
			await reload();
		}));
	}
}

// 今開いてるgoファイルを対象に、code lensを更新する。
export async function reload() {
	const doc = vscode.window.activeTextEditor?.document;
	if (doc) {
		const currentFileUri = doc.uri;
		
		const funcStartPositions = readAST(doc);

		// 件数が0件以上であればcode lenseを更新する。
		if (0 < funcStartPositions.length) {
			await updateReferenceCodeLenseIfNeed(currentFileUri, funcStartPositions);
		}
	}
}

function readAST(doc : vscode.TextDocument) : Position[] {
	// TODO: この関数は全くASTなんて読んでない。適当にfunc で始まる行を取り出してる。実際これで割と上手くいきそうだけど、フィールドとかを読む時はその開始位置をコレクションする必要がどうしてもある。

	const funcStartPositions : Position[] = [];

	// 適当な字句解析
	const documentText = doc.getText();
	const lines = documentText.split("\n");
	
	const funcDesc = "func ";
	const funcDescLength = funcDesc.length;

	// ここでfuncStartPositionsにセットするデータは、エディタ上より1行ずれる。14ってやると15行目になる。
	lines.forEach((line, index) => {
		if (line.startsWith(funcDesc)) {// func始まり
			
			let endIndex = line.indexOf("(");// 返り値の(か関数名後の(
			if (endIndex === funcDescLength) {
				// func (s *Something) functionName() とか
				// selector部分の分解がめんどくさいんで対応してない。 contribution welcome~~.
				console.log("line:", line, "is not adopted.");
				return;
			}

			if (-1 < endIndex) {// 括弧始まりが同じ行に含まれている
				// console.log("func line:", index, line.substring("func ".length, endIndex));
				funcStartPositions.push(new Position(index, 5));
			}
		}
	});

	return funcStartPositions;
}

// code lenseを更新する。
async function updateReferenceCodeLenseIfNeed(currentFileUri:Uri, funcStartPositions: Position[]) {
	const refLenseDataArray = new Array<[Uri, Position, Number]>();

	// 発見したfunctionの数だけ、reference取得を実行し、code lenseを更新する。
	await Promise.all(
		funcStartPositions.map(async startPos => {
			// reference countを出す場所を割り出し、code lenseの位置に表示を出す。
			// TODO: ここにサラッと書いてあるcurrentFileUriは、今は最初に開いたファイルのものなので、on何ちゃらのハンドラで開いたファイルのものにすげ替えないといけない。
			const locations : Array<Location> = await commands.executeCommand('vscode.executeReferenceProvider', currentFileUri, startPos);

			// 対象の部位に際してreferenceが1件以上あれば。
			if (0 < locations.length) {
				var refCount = 0;

				// 参照数を集計
				locations.forEach(element => {
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
	));
	
	// レンズのリロードを行う。変更点があったところだけ、、とかが無理なので、全体をリロードする。複数のファイルを開いてる場合も何とかなるのか？
	refProvider.update(refLenseDataArray);
}